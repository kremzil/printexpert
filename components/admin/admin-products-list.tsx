"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table"
import { ChevronDown } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type AdminProductItem = {
  id: string
  name: string
  slug: string
  isActive: boolean
  category: {
    name: string
    slug: string
  } | null
}

type AdminProductsListProps = {
  products: AdminProductItem[]
}

const columns: ColumnDef<AdminProductItem>[] = [
  {
    accessorKey: "name",
    header: "Názov",
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.getValue("name")}</div>
        <div className="text-xs text-muted-foreground">
          {row.original.slug}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "category",
    header: "Kategória",
    cell: ({ row }) => {
      const category = row.original.category
      return <div>{category?.name ?? "Bez kategórie"}</div>
    },
    filterFn: (row, id, value) => {
      if (value === "all") return true
      if (value === "none") return !row.original.category
      return row.original.category?.slug === value
    },
  },
  {
    accessorKey: "isActive",
    header: "Stav",
    cell: ({ row }) => {
      const isActive = row.getValue("isActive") as boolean
      return (
        <Badge variant={isActive ? "secondary" : "outline"}>
          {isActive ? "Aktívny" : "Neaktívny"}
        </Badge>
      )
    },
    filterFn: (row, id, value) => {
      if (value === "all") return true
      if (value === "active") return row.getValue(id) === true
      if (value === "inactive") return row.getValue(id) === false
      return true
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const product = row.original
      return (
        <div className="flex justify-end">
          <Button
            asChild
            variant="outline"
            size="sm"
            onClick={(e) => e.stopPropagation()}
          >
            <Link href={`/admin/products/${product.id}`}>Upraviť</Link>
          </Button>
        </div>
      )
    },
  },
]

export function AdminProductsList({ products }: AdminProductsListProps) {
  const router = useRouter()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = useState("")

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>()
    products.forEach((product) => {
      if (product.category?.slug && product.category?.name) {
        map.set(product.category.slug, product.category.name)
      }
    })
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [products])

  const table = useReactTable({
    data: products,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, columnId, filterValue) => {
      const search = filterValue.toLowerCase()
      return (
        row.original.name.toLowerCase().includes(search) ||
        row.original.slug.toLowerCase().includes(search) ||
        (row.original.category?.name ?? "").toLowerCase().includes(search)
      )
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-1 items-center gap-2">
          <Input
            placeholder="Hľadať produkty..."
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="max-w-sm"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Stĺpce <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <select
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={
            (table.getColumn("isActive")?.getFilterValue() as string) ?? "all"
          }
          onChange={(event) =>
            table.getColumn("isActive")?.setFilterValue(event.target.value)
          }
        >
          <option value="all">Všetky stavy</option>
          <option value="active">Aktívne</option>
          <option value="inactive">Neaktívne</option>
        </select>

        <select
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={
            (table.getColumn("category")?.getFilterValue() as string) ?? "all"
          }
          onChange={(event) =>
            table.getColumn("category")?.setFilterValue(event.target.value)
          }
        >
          <option value="all">Všetky kategórie</option>
          <option value="none">Bez kategórie</option>
          {categoryOptions.map(([slug, name]) => (
            <option key={slug} value={slug}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer"
                  onClick={() => router.push(`/admin/products/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Žiadne výsledky.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-2">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} z {products.length}{" "}
          produktov
        </div>
        <div className="flex items-center space-x-6 lg:space-x-8">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Riadkov na stranu</p>
            <select
              className="h-8 w-[70px] rounded-md border border-input bg-transparent px-2 text-sm"
              value={table.getState().pagination.pageSize}
              onChange={(e) => {
                table.setPageSize(Number(e.target.value))
              }}
            >
              {[10, 20, 30, 40, 50].map((pageSize) => (
                <option key={pageSize} value={pageSize}>
                  {pageSize}
                </option>
              ))}
            </select>
          </div>
          <div className="flex w-[100px] items-center justify-center text-sm font-medium">
            Strana {table.getState().pagination.pageIndex + 1} z{" "}
            {table.getPageCount()}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Prvá strana</span>
              <span>«</span>
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Predchádzajúca strana</span>
              <span>‹</span>
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Ďalšia strana</span>
              <span>›</span>
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Posledná strana</span>
              <span>»</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
