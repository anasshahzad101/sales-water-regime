import type { SVGProps } from "react";
import {
  Accessibility, AlarmClock, Archive, ArrowDown, ArrowDownAZ, ArrowLeft, ArrowUp, ArrowRight, Briefcase, User, UserCheck, ArrowRightLeft, ArrowUpRight, BadgeCheck, Building2,
  CalendarCheck, CalendarClock, CalendarDays, CalendarX, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, Circle,
  CircleAlert, CircleCheck, CircleDashed, CircleDot, CircleHelp, CircleSlash, CircleX, ClipboardList, Clock, Copy, Download, Ellipsis,
  ExternalLink, Eye, EyeOff, Factory, FilePen, FileSpreadsheet, FileText, Filter, Flag, Gauge, Hand, Handshake, Hash, History,
  Hourglass, Info, Kanban, KeyRound, Layers, List, LoaderCircle, Lock, LogIn, LogOut, Mail, MapPin, Menu, MessageCircle, Moon,
  NotebookPen, Pencil, Phone, Plus, Presentation, RefreshCw, RotateCcw, Route, Scale, ScrollText, Search, SearchX, Send, Shield,
  ShieldCheck, SignalHigh, SignalLow, SignalMedium, SkipForward, SlidersHorizontal, Star, Sun, SunMoon, Tag, Target, ThumbsDown,
  ThumbsUp, Timer, Trash2, TriangleAlert, Trophy, Undo2, UserPlus, Users, UsersRound, UserX, WifiOff, X,
  type LucideIcon,
} from "lucide-react";

function Linkedin(props: SVGProps<SVGSVGElement> & { size?: number | string }) {
  const { size = 24, ...rest } = props;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

const ICONS = {
  accessibility: Accessibility, "alarm-clock": AlarmClock, archive: Archive, "arrow-down": ArrowDown, "arrow-up": ArrowUp, "arrow-down-a-z": ArrowDownAZ, "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight, "arrow-right-left": ArrowRightLeft, "arrow-up-right": ArrowUpRight, "badge-check": BadgeCheck, briefcase: Briefcase, user: User, "user-check": UserCheck,
  "building-2": Building2, "calendar-check": CalendarCheck, "calendar-clock": CalendarClock, "calendar-days": CalendarDays,
  "calendar-x": CalendarX, check: Check, "chevron-down": ChevronDown, "chevron-left": ChevronLeft, "chevron-right": ChevronRight,
  "chevrons-up-down": ChevronsUpDown, circle: Circle, "circle-alert": CircleAlert, "circle-check": CircleCheck,
  "circle-dashed": CircleDashed, "circle-dot": CircleDot, "circle-help": CircleHelp, "circle-slash": CircleSlash, "circle-x": CircleX,
  "clipboard-list": ClipboardList, clock: Clock, copy: Copy, download: Download, ellipsis: Ellipsis, "external-link": ExternalLink,
  eye: Eye, "eye-off": EyeOff, factory: Factory, "file-pen": FilePen, "file-spreadsheet": FileSpreadsheet, "file-text": FileText,
  filter: Filter, flag: Flag, gauge: Gauge, hand: Hand, handshake: Handshake, hash: Hash, history: History, hourglass: Hourglass,
  info: Info, kanban: Kanban, "key-round": KeyRound, layers: Layers, linkedin: Linkedin as unknown as LucideIcon, list: List,
  "loader-circle": LoaderCircle, lock: Lock, "log-in": LogIn, "log-out": LogOut, mail: Mail, "map-pin": MapPin, menu: Menu,
  "message-circle": MessageCircle, moon: Moon, "notebook-pen": NotebookPen, pencil: Pencil, phone: Phone, plus: Plus,
  presentation: Presentation, "refresh-cw": RefreshCw, "rotate-ccw": RotateCcw, route: Route, scale: Scale, "scroll-text": ScrollText,
  search: Search, "search-x": SearchX, send: Send, shield: Shield, "shield-check": ShieldCheck, "signal-high": SignalHigh,
  "signal-low": SignalLow, "signal-medium": SignalMedium, "skip-forward": SkipForward, "sliders-horizontal": SlidersHorizontal,
  star: Star, sun: Sun, "sun-moon": SunMoon, tag: Tag, target: Target, "thumbs-down": ThumbsDown, "thumbs-up": ThumbsUp,
  timer: Timer, "trash-2": Trash2, "triangle-alert": TriangleAlert, trophy: Trophy, "undo-2": Undo2, "user-plus": UserPlus,
  users: Users, "users-round": UsersRound, "user-x": UserX, "wifi-off": WifiOff, x: X,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 16,
  className,
  strokeWidth = 2,
  style,
}: {
  name: IconName | (string & {});
  size?: number;
  className?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}) {
  const C = (ICONS as Record<string, LucideIcon>)[name] ?? Circle;
  return <C size={size} strokeWidth={strokeWidth} className={className} style={{ flex: "none", ...style }} aria-hidden="true" />;
}
