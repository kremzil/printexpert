"use client"

import Link from "next/link"
import Image from "next/image"
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
import { MoreHorizontal, Eye, Edit, Trash, ArrowUpDown, Filter } from "lucide-react"

import { AdminBadge } from "@/components/admin/admin-badge"
import { AdminButton } from "@/components/admin/admin-button"
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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatPrice } from "@/lib/utils"

type AdminProductItem = {
  id: string
  name: string
  slug: string
  isActive: boolean
  showInB2b: boolean
  showInB2c: boolean
  priceFrom: string | null
  vatRate: string
  category: {
    name: string
    slug: string
  } | null
  images?: {
    url: string
    alt: string | null
  }[]
  _count?: {
      orderItems: number
  }
}

type AdminProductsListProps = {
  products: AdminProductItem[]
}

const columns: ColumnDef<AdminProductItem>[] = [
  {
    accessorKey: "images",
    header: "Obrázok",
    cell: ({ row }) => {
      const image = row.original.images?.[0]
      return (
        <div className="relative h-10 w-10 overflow-hidden rounded-md border bg-muted">
          {image ? (
            <Image
              src={image.url}
              alt={image.alt || row.original.name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
              Bez foto
            </div>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "name",
    header: ({ column }) => {
        return (
          <AdminButton
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Názov
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </AdminButton>
        )
    },
    cell: ({ row }) => (
      <div>
        <div className="font-medium hover:underline">
            <Link href={`/admin/products/${row.original.id}`}>
                {row.getValue("name")}
            </Link>
        </div>
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
      return (
        <AdminBadge variant="default" size="sm">
            {category?.name ?? "Bez kategórie"}
        </AdminBadge>
        )
    },
    filterFn: (row, id, value) => {
      if (value === "all") return true
      if (value === "none") return !row.original.category
      return row.original.category?.slug === value
    },
  },
  {
      accessorKey: "priceFrom",
      header: "Cena od",
      cell: ({ row }) => {
          const price = row.original.priceFrom
          return price 
            ? <div className="font-mono text-sm">{formatPrice(Number(price))}</div> 
            : <span className="text-xs text-muted-foreground">Na vyžiadanie</span>
      }
  },
  {
    accessorKey: "isActive",
    header: "Viditeľnosť",
    cell: ({ row }) => {
      const { isActive, showInB2b, showInB2c } = row.original
      
      if (!isActive) {
          return <AdminBadge variant="inactive">Neaktívny</AdminBadge>
      }

      return (
        <div className="flex gap-1 flex-wrap">
            {showInB2b && <AdminBadge variant="b2b" size="sm">B2B</AdminBadge>}
            {showInB2c && <AdminBadge variant="b2c" size="sm">B2C</AdminBadge>}
            {!showInB2b && !showInB2c && <AdminBadge variant="default" size="sm">Skrytý</AdminBadge>}
        </div>
      )
    },
    filterFn: (row, id, value) => {
      if (value === "all") return true
      if (value === "active") return row.original.isActive === true
      if (value === "inactive") return row.original.isActive === false
      return true
    },
  },
  {
    accessorKey: "_count.orderItems",
    header: ({ column }) => {
        return (
          <AdminButton
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Objednané
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </AdminButton>
        )
    },
    cell: ({ row }) => {
        const count = row.original._count?.orderItems || 0
        return <div className="text-center">{count}x</div>
    }
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const product = row.original
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <AdminButton variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Otvoriť menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </AdminButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Akcie</DropdownMenuLabel>
            <DropdownMenuItem asChild>
                <Link href={`/product/${product.slug}`} target="_blank">
                    <Eye className="mr-2 h-4 w-4" />
                    Zobraziť na webe
                </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
                <Link href={`/admin/products/${product.id}`}>
                    <Edit className="mr-2 h-4 w-4" />
                    Upraviť
                </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive">
               <Trash className="mr-2 h-4 w-4" />
               Zmazať
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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

  // eslint-disable-next-line react-hooks/incompatible-library
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
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Hľadať produkty..."
            value={globalFilter ?? ""}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="max-w-xs"
          />
        </div>

        <div className="flex items-center gap-2">
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <AdminButton variant="outline" size="sm" className="ml-auto h-8 border-dashed">
                <Filter className="mr-2 h-4 w-4" />
                Kategórie
                </AdminButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-50">
                <DropdownMenuLabel>Filtrovať podľa kategórie</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                    checked={!table.getColumn("category")?.getFilterValue()}
                    onCheckedChange={() => table.getColumn("category")?.setFilterValue(undefined)}
                >
                    Všetky kategórie
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                    checked={table.getColumn("category")?.getFilterValue() === "none"}
                    onCheckedChange={(checked) => 
                        table.getColumn("category")?.setFilterValue(checked ? "none" : undefined)
                    }
                >
                    Bez kategórie
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                {categoryOptions.map(([slug, name]) => (
                <DropdownMenuCheckboxItem
                    key={slug}
                    checked={table.getColumn("category")?.getFilterValue() === slug}
                    onCheckedChange={(checked) => 
                        table.getColumn("category")?.setFilterValue(checked ? slug : undefined)
                    }
                >
                    {name}
                </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <AdminButton variant="outline" size="sm" className="ml-auto h-8 border-dashed">
                <Filter className="mr-2 h-4 w-4" />
                Stav
                </AdminButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Filtrovať podľa stavu</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                checked={!table.getColumn("isActive")?.getFilterValue()}
                onCheckedChange={() => table.getColumn("isActive")?.setFilterValue(undefined)}
                >
                Všetky stavy
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                checked={table.getColumn("isActive")?.getFilterValue() === "active"}
                onCheckedChange={(checked) => 
                    table.getColumn("isActive")?.setFilterValue(checked ? "active" : undefined)
                }
                >
                Len aktívne
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                checked={table.getColumn("isActive")?.getFilterValue() === "inactive"}
                onCheckedChange={(checked) => 
                    table.getColumn("isActive")?.setFilterValue(checked ? "inactive" : undefined)
                }
                >
                Len neaktívne
                </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
            </DropdownMenu>
            
             <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <AdminButton variant="outline" size="sm" className="ml-auto h-8">
                  <Eye className="mr-2 h-4 w-4" />
                  Stĺpce
                </AdminButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Zobraziť stĺpce</DropdownMenuLabel>
                <DropdownMenuSeparator />
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
                        {column.id === "images" && "Obrázok"}
                        {column.id === "name" && "Názov"}
                        {column.id === "category" && "Kategória"}
                        {column.id === "isActive" && "Stav"}
                        {column.id === "priceFrom" && "Cena"}
                        {column.id === "_count_orderItems" && "Predajnosť"}
                        {column.id !== "images" && column.id !== "name" && column.id !== "category" && column.id !== "isActive" && column.id !== "priceFrom" && column.id !== "_count_orderItems" && column.id}
                      </DropdownMenuCheckboxItem>
                    )
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
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
                  Žiadne produkty.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} produktov celkom.
        </div>
        <div className="space-x-2">
          <AdminButton
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Späť
          </AdminButton>
          <AdminButton
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Ďalej
          </AdminButton>
        </div>
      </div>
    </div>
  )
}
