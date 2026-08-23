import cls from './styles.module.css'

export type TableColumn<T> = {
  key: keyof T
  header: string
  render?: (row: T) => React.ReactNode
  align?: 'left' | 'center' | 'right'
}

export function Table<T extends Record<string, unknown>>({
  columns,
  rows,
  getRowKey,
}: {
  columns: Array<TableColumn<T>>
  rows: T[]
  getRowKey: (row: T, index: number) => string
}) {
  return (
    <div className={cls.tableWrap}>
      <table className={cls.table}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={String(c.key)} style={{ textAlign: c.align ?? 'left' }}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={getRowKey(row, idx)}>
              {columns.map((c) => (
                <td key={String(c.key)} style={{ textAlign: c.align ?? 'left' }}>
                  {c.render ? c.render(row) : String(row[c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

