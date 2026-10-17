import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Brain,
  Camera,
  ClipboardList,
  Eye,
  Hand,
  MessageSquare,
  Sparkles,
} from 'lucide-react'
import parkinsonsHero from '../assets/images/parkinsons-hero.jpg'
import glossHero from '../assets/images/gloss-hero.jpg'
import TeamLearning from '../components/supervisor/TeamLearning'
import TeamPopup from '../components/supervisor/TeamPopup'
import { shouldShowTeamPopup } from '../utils/teamPopup'
import { createSupervisorLearnerProfile, getGlossMe, getSupervisorOverview } from '../services/glossApi'
import type { GlossMe, SupervisorOverview } from '../types/gloss'

type Accent = 'purple' | 'blue'

// Module-specific accent classes. Kept as complete literal strings (not
// interpolated) so Tailwind's compiler keeps them.
const ACCENTS: Record<
  Accent,
  {
    badge: string
    iconBox: string
    feature: string
    cta: string
    cardHoverBorder: string
    ctaRing: string
  }
> = {
  purple: {
    badge: 'bg-violet-600',
    iconBox: 'bg-violet-50 text-violet-600',
    feature: 'text-violet-600',
    cta: 'bg-violet-600 hover:bg-violet-700',
    cardHoverBorder: 'hover:border-violet-300',
    ctaRing: 'focus-visible:ring-violet-500',
  },
  blue: {
    badge: 'bg-blue-700',
    iconBox: 'bg-blue-50 text-blue-700',
    feature: 'text-blue-700',
    cta: 'bg-blue-700 hover:bg-blue-800',
    cardHoverBorder: 'hover:border-blue-300',
    ctaRing: 'focus-visible:ring-blue-500',
  },
}

interface ModuleFeature {
  icon: ReactNode
  label: string
}

interface LearningModuleCardProps {
  accent: Accent
  image: string
  imageAlt: string
  badgeIcon: ReactNode
  badgeLabel: string
  mainIcon: ReactNode
  title: string
  description: string
  features: ModuleFeature[]
  onStart: () => void
}

function LearningModuleCard({
  accent,
  image,
  imageAlt,
  badgeIcon,
  badgeLabel,
  mainIcon,
  title,
  description,
  features,
  onStart,
}: LearningModuleCardProps) {
  const a = ACCENTS[accent]

  return (
    <article
      className={`flex flex-col rounded-[20px] border border-[#E5EAF2] bg-white p-5 shadow-[var(--shadow-sm)] transition duration-200 ease-out hover:-translate-y-[3px] hover:shadow-[var(--shadow-md)] motion-reduce:transform-none motion-reduce:transition-none sm:p-6 ${a.cardHoverBorder}`}
    >
      {/* Image + category badge */}
      <div className="relative">
        <img
          src={image}
          alt={imageAlt}
          className="h-56 w-full rounded-[14px] object-cover sm:h-64 lg:h-[340px]"
        />
        <span
          className={`absolute left-3 top-3 inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold uppercase tracking-wide text-white shadow-sm ${a.badge}`}
        >
          {badgeIcon}
          {badgeLabel}
        </span>
      </div>

      {/* Content — flex-1 so the CTA row aligns across both cards */}
      <div className="flex flex-1 flex-col gap-3 pt-4">
        <div className="flex items-start gap-3">
          <span
            className={`grid h-16 w-16 shrink-0 place-items-center rounded-xl ${a.iconBox}`}
            aria-hidden="true"
          >
            {mainIcon}
          </span>
          <h3 className="text-[1.6rem] font-bold leading-tight text-[var(--brand-blue)] sm:text-[1.7rem] lg:text-[1.85rem]">
            {title}
          </h3>
        </div>

        <p className="max-w-prose text-[15px] leading-relaxed text-slate-500">{description}</p>

        <ul className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[13px] text-slate-600">
          {features.map((feature, index) => (
            <li key={feature.label} className="inline-flex items-center gap-2">
              {index > 0 && (
                <span className="text-slate-300" aria-hidden="true">
                  &bull;
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <span className={a.feature} aria-hidden="true">
                  {feature.icon}
                </span>
                {feature.label}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-auto border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onStart}
            className={`flex h-12 w-full items-center justify-between rounded-lg px-4 text-sm font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${a.cta} ${a.ctaRing}`}
          >
            <span>Start Learning</span>
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  )
}

export default function Overview() {
  const navigate = useNavigate()
  // Supervisors (role from the server): Team learning, the daily popup, and
  // their own learning once they have a learner profile.
  const [me, setMe] = useState<GlossMe | null>(null)
  const [overview, setOverview] = useState<SupervisorOverview | null>(null)
  const [overviewError, setOverviewError] = useState<string | null>(null)
  const [popup, setPopup] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const loadOverview = useCallback((userKey: string, withPopup: boolean) => {
    setOverviewError(null)
    getSupervisorOverview()
      .then((o) => {
        setOverview(o)
        if (withPopup && shouldShowTeamPopup(userKey)) setPopup(true)
      })
      .catch((e: unknown) => setOverviewError(e instanceof Error ? e.message : 'Unavailable'))
  }, [])

  useEffect(() => {
    getGlossMe()
      .then((m) => {
        setMe(m)
        if (m.is_supervisor) loadOverview(m.name ?? 'supervisor', true)
      })
      .catch(() => {
        /* not signed in / backend down: the learning cards still work as before */
      })
  }, [loadOverview])

  // A supervisor's first "Start learning" creates their learner profile.
  const start = async (path: string) => {
    setStartError(null)
    if (me?.is_supervisor && !me.learner_id) {
      try {
        const { learner_id } = await createSupervisorLearnerProfile()
        setMe({ ...me, learner_id })
      } catch (e) {
        setStartError(e instanceof Error ? e.message : 'Could not start your learning profile.')
        return
      }
    }
    navigate(path)
  }

  const viewTeam = () => {
    setPopup(false)
    document.getElementById('team-learning')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="w-full">
      <div className="flex flex-col gap-10">
        {/* Page header */}
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-[var(--brand-blue)] sm:text-[1.75rem]">
            Sign &amp; Vitals
          </h1>
          <p className="text-[15px] text-slate-500">
            Build practical caregiving skills through interactive learning.
          </p>
        </header>

        {me?.is_supervisor && (
          <TeamLearning overview={overview} error={overviewError} onRetry={() => loadOverview(me.name ?? 'supervisor', false)} />
        )}

        {/* Module selection heading */}
        <section className="flex flex-col gap-6">
          <div className="flex flex-col items-start gap-2 text-left">
            <h2 className="text-2xl font-bold text-[var(--brand-blue)] sm:text-[1.9rem]">
              Choose a learning module
            </h2>
            <p className="text-[15px] text-slate-500 sm:text-base">
              {me?.is_supervisor
                ? 'Your own learning: progress is yours and is not listed in Team learning.'
                : 'Select an area to begin your training.'}
            </p>
            {startError && <p className="text-base text-rose-700">{startError}</p>}
            <span
              className="mt-1 h-1 w-12 rounded-full bg-gradient-to-r from-violet-400 to-blue-500"
              aria-hidden="true"
            />
          </div>

          {/* Two-card layout */}
          <div className="grid w-full gap-8 md:grid-cols-2 lg:gap-10">
            <LearningModuleCard
              accent="purple"
              image={parkinsonsHero}
              imageAlt="Illustration representing Parkinson's symptom training"
              badgeIcon={<Brain size={14} aria-hidden="true" />}
              badgeLabel="Symptom Training"
              mainIcon={<Brain size={26} aria-hidden="true" />}
              title="Parkinson's Symptom Education"
              description="Learn to recognize key Parkinson's symptoms through guided lessons, scenarios and quizzes."
              features={[
                { icon: <Eye size={15} />, label: 'Symptom Recognition' },
                { icon: <ClipboardList size={15} />, label: 'Scenarios' },
                { icon: <BarChart3 size={15} />, label: 'Adaptive Quizzes' },
              ]}
              onStart={() => void start('/sign-vitals/parkinsons')}
            />

            <LearningModuleCard
              accent="blue"
              image={glossHero}
              imageAlt="Illustration representing sign language learning"
              badgeIcon={<Hand size={14} aria-hidden="true" />}
              badgeLabel="Sign Language"
              mainIcon={<Hand size={26} aria-hidden="true" />}
              title="GLOSS Sign Language Learning"
              description="Practice care-related signs using AI recognition and personalised feedback."
              features={[
                { icon: <Camera size={15} />, label: 'Webcam Practice' },
                { icon: <Sparkles size={15} />, label: 'AI Recognition' },
                { icon: <MessageSquare size={15} />, label: 'Personalised Feedback' },
              ]}
              onStart={() => void start('/sign-vitals/sign-language')}
            />
          </div>
        </section>
      </div>
      {popup && overview && me && (
        <TeamPopup userKey={me.name ?? 'supervisor'} lines={overview.popup} onClose={() => setPopup(false)} onViewTeam={viewTeam} />
      )}
    </div>
  )
}
