import { Check, X } from "lucide-react"

interface ComparisonRow {
  feature: string
  b2c: boolean | string
  b2b: boolean | string
}

interface ComparisonTableProps {
  rows: ComparisonRow[]
}

export function ComparisonTable({ rows }: ComparisonTableProps) {
  const renderCell = (value: boolean | string, isB2C: boolean) => {
    const color = isB2C ? "var(--b2c-primary)" : "var(--b2b-primary)"

    if (typeof value === "boolean") {
      return value ? (
        <Check className="mx-auto h-5 w-5" style={{ color }} />
      ) : (
        <X className="mx-auto h-5 w-5 text-muted-foreground/30" />
      )
    }
    return <span className="text-sm font-medium">{value}</span>
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="p-4 text-left text-sm font-semibold">Funkcia</th>
              <th
                className="p-4 text-center text-sm font-semibold"
                style={{ color: "var(--b2c-primary)" }}
              >
                B2C režim
              </th>
              <th
                className="p-4 text-center text-sm font-semibold"
                style={{ color: "var(--b2b-primary)" }}
              >
                B2B režim
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={index}
                className="border-b border-border last:border-b-0 transition-colors hover:bg-muted/30"
              >
                <td className="p-4 text-sm text-muted-foreground">
                  {row.feature}
                </td>
                <td className="p-4 text-center">
                  {renderCell(row.b2c, true)}
                </td>
                <td className="p-4 text-center">
                  {renderCell(row.b2b, false)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
