interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
}

export default function KpiCard({ label, value, sub }: KpiCardProps) {
  return (
    <div className="glass rounded-xl p-4">
      <p className="text-white/50 text-xs font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className="text-white text-2xl font-bold">{value}</p>
      {sub && <p className="text-white/40 text-xs mt-0.5">{sub}</p>}
    </div>
  )
}
