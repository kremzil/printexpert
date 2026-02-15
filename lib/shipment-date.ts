type DateParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

type Ymd = {
  year: number
  month: number
  day: number
}

export type ShipmentDateOptions = {
  productionDays: number
  cutoffHour: number
  cutoffMinute: number
  excludeWeekendDays: boolean
  timeZone: string
  now?: Date
}

export type ShipmentDateResult = {
  isoDate: string
  formattedDate: string
}

const pad = (value: number) => String(value).padStart(2, "0")

const toIsoDate = ({ year, month, day }: Ymd) =>
  `${year}-${pad(month)}-${pad(day)}`

const formatSkDate = ({ year, month, day }: Ymd) =>
  `${pad(day)}.${pad(month)}.${year}`

const toUtcDate = ({ year, month, day }: Ymd) =>
  new Date(Date.UTC(year, month - 1, day))

const addDays = (value: Ymd, days: number): Ymd => {
  const date = toUtcDate(value)
  date.setUTCDate(date.getUTCDate() + days)
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  }
}

const isWeekend = (value: Ymd) => {
  const day = toUtcDate(value).getUTCDay()
  return day === 0 || day === 6
}

const getDatePartsInTimeZone = (date: Date, timeZone: string): DateParts => {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })

  const values = formatter.formatToParts(date).reduce<Record<string, string>>(
    (acc, part) => {
      if (part.type !== "literal") {
        acc[part.type] = part.value
      }
      return acc
    },
    {}
  )

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  }
}

const moveToNextBusinessDay = (
  value: Ymd,
  excludeWeekendDays: boolean
): Ymd => {
  let cursor = addDays(value, 1)
  if (!excludeWeekendDays) {
    return cursor
  }

  while (isWeekend(cursor)) {
    cursor = addDays(cursor, 1)
  }

  return cursor
}

const addProductionDays = (
  start: Ymd,
  productionDays: number,
  excludeWeekendDays: boolean
): Ymd => {
  let cursor = start
  let remaining = Math.max(1, Math.floor(productionDays)) - 1

  while (remaining > 0) {
    cursor = addDays(cursor, 1)
    if (excludeWeekendDays && isWeekend(cursor)) {
      continue
    }
    remaining -= 1
  }

  return cursor
}

export const calculateShipmentDate = ({
  productionDays,
  cutoffHour,
  cutoffMinute,
  excludeWeekendDays,
  timeZone,
  now = new Date(),
}: ShipmentDateOptions): ShipmentDateResult => {
  const localNow = getDatePartsInTimeZone(now, timeZone)
  let start: Ymd = {
    year: localNow.year,
    month: localNow.month,
    day: localNow.day,
  }

  const afterCutoff =
    localNow.hour > cutoffHour ||
    (localNow.hour === cutoffHour && localNow.minute > cutoffMinute)

  if (
    afterCutoff ||
    (excludeWeekendDays && isWeekend(start))
  ) {
    start = moveToNextBusinessDay(start, excludeWeekendDays)
  }

  const shipmentDate = addProductionDays(
    start,
    productionDays,
    excludeWeekendDays
  )

  return {
    isoDate: toIsoDate(shipmentDate),
    formattedDate: formatSkDate(shipmentDate),
  }
}
