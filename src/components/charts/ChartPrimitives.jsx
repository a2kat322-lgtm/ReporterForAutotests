export function Legend({ series }) {
  return (
    <div className="simple-chart-legend">
      {series.map((item) => (
        <span key={item.key}><i style={{ background: item.color }} />{item.label}</span>
      ))}
    </div>
  )
}

export function EmptyChart({ label }) {
  return <div className="simple-chart-empty">{label}</div>
}
