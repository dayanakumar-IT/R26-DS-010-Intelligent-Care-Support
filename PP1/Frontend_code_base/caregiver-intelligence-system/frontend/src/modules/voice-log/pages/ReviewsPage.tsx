import { CheckCircle2, ClipboardCheck, Pencil, ThumbsDown, ThumbsUp, Calendar, Save, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../../shared/components/Button'
import { StatusBadge } from '../components/StatusBadge'
import type { ADLReport } from '../data/mockCareData'
import { adlReports, patients } from '../data/mockCareData'

type ReviewItem = {
  reportId: string
  patientId: string
  reportType: 'ADL'
  date: string
  submittedAtLabel: string
  submittedBy: string
  status: 'Pending' | 'Reviewed'
  outcome?: 'Approved' | 'Rejected'
  notes: string
}

function getLatestDate(list: ADLReport[]) {
  // ISO date strings compare lexicographically
  return list.reduce((max, r) => (r.date > max ? r.date : max), list[0]?.date ?? '2026-03-31')
}

function toReviewItem(r: ADLReport): ReviewItem {
  return {
    reportId: r.id,
    patientId: r.patientId,
    reportType: 'ADL',
    date: r.date,
    submittedAtLabel: `${r.date} ${r.submittedAt}`,
    submittedBy: r.submittedBy,
    status: r.reviewed ? 'Reviewed' : 'Pending',
    outcome: r.reviewed ? 'Approved' : undefined,
    notes: r.notes,
  }
}

export function ReviewsPage() {
  const [selectedDate, setSelectedDate] = useState(() => getLatestDate(adlReports))
  const [itemsById, setItemsById] = useState<Record<string, ReviewItem>>({})
  const editDialogRef = useRef<HTMLDialogElement | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftNotes, setDraftNotes] = useState('')

  const reportsForDate = useMemo(
    () => adlReports.filter((r) => r.date === selectedDate),
    [selectedDate],
  )

  // Ensure we always have a local editable copy for the chosen date
  useEffect(() => {
    setItemsById((prev) => {
      const next = { ...prev }
      for (const r of reportsForDate) {
        if (!next[r.id]) next[r.id] = toReviewItem(r)
      }
      return next
    })
  }, [reportsForDate])

  const items = useMemo(
    () => reportsForDate.map((r) => itemsById[r.id] ?? toReviewItem(r)),
    [itemsById, reportsForDate],
  )

  const pending = useMemo(() => items.filter((i) => i.status === 'Pending'), [items])
  const reviewed = useMemo(() => items.filter((i) => i.status === 'Reviewed'), [items])

  const mark = (reportId: string, next: Pick<ReviewItem, 'status' | 'outcome'>) => {
    setItemsById((prev) => ({ ...prev, [reportId]: { ...(prev[reportId] ?? items.find((x) => x.reportId === reportId)!), ...next } }))
  }

  const openEdit = (reportId: string) => {
    const item = items.find((x) => x.reportId === reportId)
    if (!item) return
    setEditingId(reportId)
    setDraftNotes(item.notes)
    editDialogRef.current?.showModal()
  }

  const closeEdit = () => {
    editDialogRef.current?.close()
    setEditingId(null)
    setDraftNotes('')
  }

  const saveEdit = () => {
    if (!editingId) return
    setItemsById((prev) => ({
      ...prev,
      [editingId]: { ...(prev[editingId] ?? items.find((x) => x.reportId === editingId)!), notes: draftNotes },
    }))
    closeEdit()
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-extrabold tracking-tight">Reviews</div>
          <div className="mt-1 text-sm vl-subtle">Approve, reject, or edit ADL reports before finalizing.</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="vl-chip" style={{ gap: 10 }}>
            <Calendar size={14} />
            <span className="text-xs font-extrabold">Date</span>
            <input
              type="date"
              min="2026-03-01"
              max="2026-03-31"
              className="bg-transparent text-xs font-semibold outline-none"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              aria-label="Review date"
            />
          </label>
          <span className="vl-chip">
            <ClipboardCheck size={14} />
            {pending.length} pending
          </span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <QueueCard
          title="Pending ADL reports"
          items={pending}
          empty="No pending reviews."
          actions={(id) => (
            <div className="flex flex-wrap items-center gap-2">
              <Button className="vl-btn" variant="primary" size="sm" onClick={() => mark(id, { status: 'Reviewed', outcome: 'Approved' })}>
                <span className="inline-flex items-center gap-2">
                  <ThumbsUp size={16} />
                  Approve
                </span>
              </Button>
              <Button className="vl-btn" variant="secondary" size="sm" onClick={() => openEdit(id)}>
                <span className="inline-flex items-center gap-2">
                  <Pencil size={16} />
                  Edit
                </span>
              </Button>
              <Button className="vl-btn" variant="ghost" size="sm" onClick={() => mark(id, { status: 'Reviewed', outcome: 'Rejected' })}>
                <span className="inline-flex items-center gap-2">
                  <ThumbsDown size={16} />
                  Reject
                </span>
              </Button>
            </div>
          )}
        />

        <QueueCard
          title="Reviewed reports"
          items={reviewed}
          empty="No reviewed reports yet."
          actions={(id) => {
            const it = reviewed.find((x) => x.reportId === id)
            const approved = it?.outcome !== 'Rejected'
            return (
              <span
                className="vl-chip"
                style={{
                  background: approved ? 'rgba(22,163,74,0.10)' : 'rgba(239,68,68,0.10)',
                  color: approved ? 'var(--vl-success)' : 'var(--vl-danger)',
                  borderColor: approved ? 'rgba(22,163,74,0.18)' : 'rgba(239,68,68,0.18)',
                }}
              >
                <CheckCircle2 size={14} color={approved ? 'var(--vl-success)' : 'var(--vl-danger)'} />
                {approved ? 'Approved' : 'Rejected'}
              </span>
            )
          }}
        />
      </div>

      <dialog
        ref={(el) => {
          editDialogRef.current = el
        }}
        className="rounded-2xl border bg-white p-0 shadow-xl"
        style={{ borderColor: 'rgba(15,23,42,0.12)', width: 'min(720px, 92vw)' }}
      >
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4" style={{ borderColor: 'rgba(15,23,42,0.08)' }}>
          <div className="min-w-0">
            <div className="text-sm font-extrabold tracking-tight text-[#0F172A]">Edit report notes</div>
            <div className="mt-1 text-xs vl-subtle">Updates only this page (mock local state)</div>
          </div>
          <Button className="vl-iconBtn" variant="secondary" onClick={closeEdit} aria-label="Close edit dialog">
            <X size={16} />
          </Button>
        </div>
        <div className="px-5 py-4">
          <textarea
            className="min-h-[160px] w-full resize-y rounded-2xl border bg-white px-4 py-3 text-sm font-semibold outline-none"
            style={{ borderColor: 'rgba(15,23,42,0.10)' }}
            value={draftNotes}
            onChange={(e) => setDraftNotes(e.target.value)}
            placeholder="Write notes…"
          />
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <Button className="vl-btn" variant="secondary" onClick={closeEdit}>
              Cancel
            </Button>
            <Button className="vl-btn" variant="primary" onClick={saveEdit} disabled={!editingId}>
              <span className="inline-flex items-center gap-2">
                <Save size={16} />
                Save
              </span>
            </Button>
          </div>
        </div>
      </dialog>
    </div>
  )
}

function QueueCard({
  title,
  items,
  empty,
  actions,
}: {
  title: string
  items: ReviewItem[]
  empty: string
  actions: (reportId: string) => React.ReactNode
}) {
  return (
    <div className="vl-card">
      <div className="vl-cardHeader">
        <div>
          <div className="vl-cardTitle">{title}</div>
          <div className="text-xs vl-subtle">Driven by ADL reports (mock local state only)</div>
        </div>
        <span className="vl-chip">{items.length}</span>
      </div>
      <div className="vl-cardBody">
        <div className="grid gap-2">
          {items.map((i) => (
            <div
              key={i.reportId}
              className="rounded-2xl border bg-white p-3"
              style={{ borderColor: 'rgba(15,23,42,0.10)' }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-extrabold tracking-tight">
                    {i.patientId} • {i.reportType} report
                  </div>
                  <div className="mt-1 text-xs vl-subtle">
                    Submitted: {i.submittedAtLabel} • {i.submittedBy}
                    {(() => {
                      const p = patients.find((x) => x.id === i.patientId)
                      return p ? ` • ${p.branch} • Room ${p.room}` : ''
                    })()}
                  </div>
                  {i.notes ? (
                    <div className="mt-2 line-clamp-2 text-xs font-medium text-[rgba(15,23,42,0.72)]">
                      Notes: {i.notes}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge label={i.status} tone={i.status === 'Pending' ? 'warn' : 'good'} pulse={i.status === 'Pending'} />
                  {actions(i.reportId)}
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 ? <div className="text-sm vl-subtle">{empty}</div> : null}
        </div>
      </div>
    </div>
  )
}

