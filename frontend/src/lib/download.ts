"use client"

import { ApiError, errorMessage, toQuery } from "./api"

/**
 * Download a file (e.g. an Excel export) from the Django API through this
 * app's proxy, keeping the filename the server suggests.
 */
export async function downloadFile(path: string, params?: Record<string, string | number | undefined>, fallbackName = "export.xlsx") {
  const res = await fetch(`/api/django/${path.replace(/^\/|\/$/g, "")}${toQuery(params)}`)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body, errorMessage(body, `Download failed (${res.status}).`))
  }
  const disposition = res.headers.get("content-disposition") ?? ""
  const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? fallbackName
  const url = URL.createObjectURL(await res.blob())
  const link = document.createElement("a")
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
  return name
}
