import { useState } from 'react'
import { Table } from 'antd'
import { caseEmptyText, catalogEmptyText } from '../CatalogTableParts'

export default function CatalogTable({ loading, groupedCatalog, suiteColumns, caseColumns, selectedRowKeys, onSelectionChange }) {
  const [expandedKeys, setExpandedKeys] = useState([])

  return (
    <Table
      rowKey="key"
      size="small"
      loading={loading}
      columns={suiteColumns}
      dataSource={groupedCatalog}
      pagination={false}
      onRow={(suite) => ({
        // Toggle from anywhere in the row except the built-in expand control
        // (it toggles itself) and interactive children (the visibility switch).
        onClick: (event) => {
          if (event.target.closest('.ant-table-row-expand-icon')) return
          setExpandedKeys((keys) => keys.includes(suite.key)
            ? keys.filter((key) => key !== suite.key)
            : [...keys, suite.key])
        },
        style: { cursor: 'pointer' },
      })}
      expandable={{
        expandedRowKeys: expandedKeys,
        onExpandedRowsChange: setExpandedKeys,
        expandedRowRender: (suite) => (
          <Table
            className="suite-cases-table"
            rowKey="id"
            size="small"
            columns={caseColumns}
            dataSource={suite.tests}
            pagination={false}
            rowSelection={{
              selectedRowKeys,
              onChange: onSelectionChange,
            }}
            locale={{ emptyText: caseEmptyText }}
          />
        ),
      }}
      locale={{ emptyText: catalogEmptyText }}
    />
  )
}
