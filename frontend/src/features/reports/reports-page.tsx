"use client"

import { useState } from "react"

import { PageHeader } from "@/components/common/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AuditLog } from "./audit-log"
import { ReportCentre } from "./report-centre"
import { DailyProduction, MonthlySales, WasteAnalysis } from "./report-sections"

export function ReportsPage() {
  const [tab, setTab] = useState("daily")
  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader title="Reports" icon="reports" description="Production, sales and waste reports, the report centre with Excel and CSV export, and the audit log." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap" data-print="hide">
          <TabsTrigger value="daily">Daily production</TabsTrigger>
          <TabsTrigger value="monthly">Monthly sales</TabsTrigger>
          <TabsTrigger value="waste">Waste analysis</TabsTrigger>
          <TabsTrigger value="centre">Report centre</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>
        <TabsContent value="daily" className="mt-4"><DailyProduction /></TabsContent>
        <TabsContent value="monthly" className="mt-4"><MonthlySales /></TabsContent>
        <TabsContent value="waste" className="mt-4"><WasteAnalysis /></TabsContent>
        <TabsContent value="centre" className="mt-4"><ReportCentre /></TabsContent>
        <TabsContent value="audit" className="mt-4"><AuditLog /></TabsContent>
      </Tabs>
    </div>
  )
}
