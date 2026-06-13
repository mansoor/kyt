import axios, { AxiosError } from 'axios'

let isRefreshing = false
let failedQueue: Array<{ resolve: () => void; reject: (e: unknown) => void }> = []

function processQueue(error: unknown) {
  failedQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve()))
  failedQueue = []
}

const client = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as typeof error.config & { _retry?: boolean }

    if (error.response?.status === 401 && !original?._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: () => resolve(client(original!)),
            reject,
          })
        })
      }

      original!._retry = true
      isRefreshing = true

      try {
        await client.post('/auth/refresh')
        processQueue(null)
        return client(original!)
      } catch (refreshError) {
        processQueue(refreshError)
        // Clear auth state and redirect to login
        window.dispatchEvent(new CustomEvent('auth:logout'))
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)

export default client
