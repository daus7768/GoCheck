# GoCheck Design Brief

## Brand Identity

### Concept
**GoCheck** - Making group payments effortless and stress-free.

### Visual Direction (TBD)
Choose one or mix elements:
- 🏦 **Fintech Sleek:** Modern, minimalist, premium feel (blues, greens, clean typography)
- 👨‍🎓 **Casual Student Tool:** Friendly, approachable, playful (bright colors, rounded corners)
- 🍴 **Makan Tracker:** Food-focused, warm, communal feel (oranges, reds, appetite-appealing)
- 🎉 **Premium Event:** Sophisticated, elegant, celebration-focused (purples, golds, luxury)
- 🎯 **Modern Utility:** Minimalist, focus on functionality (grays, blues, technical but friendly)

## Color Palette (Proposal)

### Primary Colors
- Primary: #6366F1 (Indigo - trustworthy, modern)
- Secondary: #10B981 (Green - money, success, payment)
- Accent: #F59E0B (Amber - attention, calls-to-action)

### Neutral Colors
- Background: #F9FAFB (Light gray)
- Surface: #FFFFFF (White)
- Text Primary: #111827 (Dark gray)
- Text Secondary: #6B7280 (Medium gray)
- Border: #E5E7EB (Light border)

### Semantic Colors
- Success: #10B981 (Green - payment confirmed)
- Warning: #F59E0B (Amber - at risk, reminder)
- Error: #EF4444 (Red - payment failed)
- Info: #3B82F6 (Blue - information)

### Dark Mode
- Background: #0F172A (Very dark blue)
- Surface: #1E293B (Dark gray-blue)
- Text Primary: #F1F5F9 (Light gray)
- Borders: #334155 (Darker borders)

## Typography

### Font Stack
```
Headings: 'Inter', 'Segoe UI', sans-serif
Body: 'Inter', 'Segoe UI', sans-serif
Monospace: 'Monaco', 'Courier New', monospace
```

### Type Scale
```
H1: 32px, 700 weight (Bill titles, page headings)
H2: 24px, 600 weight (Section headings)
H3: 20px, 600 weight (Subsection headings)
Body Large: 16px, 400 weight (Main content)
Body: 14px, 400 weight (Secondary content)
Label: 12px, 500 weight (Form labels, tags)
Caption: 12px, 400 weight (Helper text, captions)
```

## Component Design System

### Buttons

**Primary Button**
- Background: #6366F1
- Text: White
- Padding: 12px 24px
- Border-radius: 8px
- Hover: #4F46E5 (darker)
- Active: #4338CA (even darker)
- Transition: 200ms ease

**Secondary Button**
- Background: #E5E7EB
- Text: #111827
- Padding: 12px 24px
- Border-radius: 8px
- Hover: #D1D5DB

**Ghost Button**
- Background: transparent
- Text: #6366F1
- Border: 1px #6366F1
- Padding: 12px 24px
- Border-radius: 8px

**Danger Button**
- Background: #EF4444
- Text: White
- Hover: #DC2626

### Input Fields
- Border: 1px solid #E5E7EB
- Border-radius: 6px
- Padding: 10px 12px
- Focus: Border #6366F1, shadow #6366F1 0 0 0 3px alpha(0.1)
- Font-size: 14px

### Cards
- Background: White
- Border-radius: 8px
- Box-shadow: 0 1px 3px rgba(0,0,0,0.1)
- Padding: 20px
- Hover shadow: 0 4px 12px rgba(0,0,0,0.15)

### Progress Bar
- Background: #E5E7EB
- Fill: #10B981 (completed), #F59E0B (in-progress)
- Height: 8px
- Border-radius: 4px
- Animation: smooth fill transition (500ms)

### Badge/Tag
- Background: #E0E7FF (light indigo)
- Text: #4F46E5 (indigo)
- Padding: 4px 12px
- Border-radius: 9999px (fully rounded)
- Font-size: 12px
- Font-weight: 500

### Status Indicators
- **Paid:** Green dot (#10B981) + "Paid" text
- **Unpaid:** Gray dot (#D1D5DB) + "Pending" text
- **At Risk:** Amber dot (#F59E0B) + "Due Soon" text

## Page Layouts

### Home / Landing
```
┌─────────────────────────────────────┐
│         Header / Navigation         │
├─────────────────────────────────────┤
│                                     │
│    Hero Section                     │
│    - Headline                       │
│    - Subheadline                    │
│    - CTA Buttons (Create Bill)      │
│                                     │
├─────────────────────────────────────┤
│    Features Section (3-4 cols)      │
├─────────────────────────────────────┤
│    How It Works Section             │
├─────────────────────────────────────┤
│    Footer                           │
└─────────────────────────────────────┘
```

### Bill Creation Form
```
┌─────────────────────────────────────┐
│    Create Bill Header               │
├─────────────────────────────────────┤
│                                     │
│  1. Basic Info                      │
│  ┌─────────────────────────────┐    │
│  │ Title input                 │    │
│  │ Amount input                │    │
│  │ Currency dropdown           │    │
│  │ Due date picker             │    │
│  │ Description textarea        │    │
│  └─────────────────────────────┘    │
│                                     │
│  2. Add Participants                │
│  ┌─────────────────────────────┐    │
│  │ Name, Email, Amount fields  │    │
│  │ [+ Add Participant] button  │    │
│  │ List of participants        │    │
│  └─────────────────────────────┘    │
│                                     │
│  [Create Bill] [Cancel]             │
│                                     │
└─────────────────────────────────────┘
```

### Bill Detail (Shared Link)
```
┌─────────────────────────────────────┐
│         Bill Details                │
├─────────────────────────────────────┤
│                                     │
│  Title                              │
│  Amount: MYR X.XX                   │
│  Due: DD MMM, 11:59 PM              │
│                                     │
│  Progress Bar: X% Collected         │
│  [████░░░░] 3/5 Paid                │
│                                     │
│  MYR XXX Collected / MYR XXX Total   │
│                                     │
│  Description                        │
│                                     │
│  Participants:                      │
│  ┌─────────────────────────────┐    │
│  │ ✓ John Doe - MYR 50        │    │
│  │ ✓ Jane Smith - MYR 50      │    │
│  │ ○ Bob Wilson - MYR 50      │    │
│  │ ○ Alice Lee - MYR 50       │    │
│  │ ✓ Eve Brown - MYR 50       │    │
│  └─────────────────────────────┘    │
│                                     │
│  [I've Paid] button                 │
│  (if not already paid)              │
│                                     │
└─────────────────────────────────────┘
```

### Organizer Dashboard
```
┌─────────────────────────────────────┐
│    Welcome back, Organizer!         │
├─────────────────────────────────────┤
│  [+ Create New Bill]                │
│                                     │
│  My Bills                           │
│  ┌─────────────────────────────┐    │
│  │ Bill 1                      │    │
│  │ MYR 500 | 3/5 Paid          │    │
│  │ Due: Tomorrow               │    │
│  │ [Share] [View] [Delete]     │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Bill 2                      │    │
│  │ MYR 1200 | 8/10 Paid        │    │
│  │ Due: Next week              │    │
│  │ [Share] [View] [Delete]     │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Bill 3                      │    │
│  │ MYR 300 | 5/5 Paid ✓ DONE   │    │
│  │ Due: Yesterday              │    │
│  │ [View] [Delete]             │    │
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

## Animations & Micro-interactions

### Button Interactions
- **Hover:** Slight lift effect (2px shadow increase)
- **Click:** Small scale down (98%) then back (100ms)
- **Loading:** Spinner or pulsing dot
- **Success:** Checkmark animation

### Progress Bar
- Fill animation: 500ms ease-out from 0% to target
- Color change on completion: brief highlight

### Form Validation
- Real-time validation feedback
- Red border on error
- Helper text appears/disappears smoothly
- Success checkmark on valid field

### List Items
- Stagger animation on load (50ms delay per item)
- Smooth fade-in
- Hover: subtle background highlight

### Modal / Transitions
- Fade in: 200ms
- Scale from center: 0.95 to 1
- Backdrop blur

## Responsive Design

### Breakpoints
```
Mobile: 320px - 640px
Tablet: 641px - 1024px
Desktop: 1025px+
```

### Mobile Optimization
- Full-width layouts
- Touch-friendly buttons (min 44px height)
- Vertical stacking
- Bottom sheet modals
- Simplified navigation (hamburger menu)
- Large, readable text
- Simplified payment confirmation (fullscreen)

### Tablet
- 2-column layouts where appropriate
- Optimal line lengths (50-75 chars)
- Moderate padding

### Desktop
- Multi-column layouts
- Sidebar navigation
- More whitespace

## Dark Mode

### Implementation
- Toggle in header/settings
- System preference detection
- Persistent user preference (localStorage)
- All colors adjusted for dark backgrounds
- Reduced contrast for eye comfort

### Dark Mode Adjustments
- Backgrounds: dark blue/gray
- Text: light gray/white
- Borders: muted, lighter
- Cards: slightly lighter than background
- Status colors: slightly adjusted for visibility

## Accessibility

- WCAG 2.1 Level AA compliance
- Color contrast ratio: 4.5:1 for text
- Keyboard navigation support
- Screen reader friendly (semantic HTML, ARIA labels)
- Focus indicators visible
- Alt text for images
- Form labels associated with inputs

## Browser Support

- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)
- Mobile browsers (iOS Safari, Chrome Mobile)
