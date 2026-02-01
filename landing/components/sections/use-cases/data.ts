export type Category =
  | "career"
  | "sales"
  | "meetings"
  | "presentations"
  | "education"
  | "personal";

export interface UseCase {
  id: string;
  title: string;
  description: string;
  suggestion: string;
  mode: string;
  category: Category;
}

export const categories: {
  id: Category;
  label: string;
  icon: string;
  color: string;
  bgLight: string;
}[] = [
  {
    id: "career",
    label: "Career",
    icon: "briefcase",
    color: "#3B82F6",
    bgLight: "rgba(59, 130, 246, 0.15)",
  },
  {
    id: "sales",
    label: "Sales",
    icon: "trending-up",
    color: "#F97316",
    bgLight: "rgba(249, 115, 22, 0.15)",
  },
  {
    id: "meetings",
    label: "Meetings",
    icon: "users",
    color: "#8B5CF6",
    bgLight: "rgba(139, 92, 246, 0.15)",
  },
  {
    id: "presentations",
    label: "Presentations",
    icon: "presentation",
    color: "#06B6D4",
    bgLight: "rgba(6, 182, 212, 0.15)",
  },
  {
    id: "education",
    label: "Education",
    icon: "graduation-cap",
    color: "#10B981",
    bgLight: "rgba(16, 185, 129, 0.15)",
  },
  {
    id: "personal",
    label: "Personal",
    icon: "heart",
    color: "#EC4899",
    bgLight: "rgba(236, 72, 153, 0.15)",
  },
];

export const useCases: UseCase[] = [
  // CAREER (6)
  {
    id: "job-interview",
    title: "Job Interview",
    description:
      "Ace behavioral questions with structured STAR responses and confident delivery",
    suggestion:
      '"For the leadership question, mention your cross-functional project: 8 engineers, 6-month timeline, 40% engagement increase."',
    mode: "Interview",
    category: "career",
  },
  {
    id: "coding-interview",
    title: "Technical Coding Interview",
    description:
      "Navigate algorithms, system design, and live coding with real-time hints",
    suggestion:
      '"Consider using a hash map here for O(1) lookup. You could also mention the time-space tradeoff."',
    mode: "Developer Exam",
    category: "career",
  },
  {
    id: "salary-negotiation",
    title: "Salary Negotiation",
    description:
      "Build compelling arguments for compensation with market data and timing",
    suggestion:
      '"Now is a good moment to mention the 3 competing offers. Ask for 15% above their initial to leave negotiation room."',
    mode: "Professional",
    category: "career",
  },
  {
    id: "assessment-center",
    title: "Assessment Center",
    description:
      "Excel in group exercises and case studies with strategic contributions",
    suggestion:
      '"The group is stuck on prioritization. Suggest using an impact/effort matrix to break the deadlock."',
    mode: "Professional",
    category: "career",
  },
  {
    id: "performance-review",
    title: "Performance Review",
    description:
      "Navigate annual reviews with documented achievements and promotion asks",
    suggestion:
      '"Bring up the 3 projects you led this quarter. This is the right moment to discuss the senior role."',
    mode: "Professional",
    category: "career",
  },
  {
    id: "internal-transfer",
    title: "Internal Transfer",
    description:
      "Successfully transition to a new role with compelling reasons and readiness",
    suggestion:
      '"Emphasize your transferable skills from the current team and your genuine interest in the new domain."',
    mode: "Interview",
    category: "career",
  },

  // SALES (6)
  {
    id: "discovery-call",
    title: "Discovery Call",
    description:
      "Qualify prospects effectively with strategic open-ended questions",
    suggestion:
      '"They mentioned budget constraints. Ask: What would the cost of NOT solving this problem be in 6 months?"',
    mode: "Sales",
    category: "sales",
  },
  {
    id: "product-demo",
    title: "Product Demo",
    description:
      "Handle objections and highlight value propositions that resonate",
    suggestion:
      '"They seem concerned about integration. Show the API documentation slide and mention the 2-week setup time."',
    mode: "Sales",
    category: "sales",
  },
  {
    id: "commercial-negotiation",
    title: "Commercial Negotiation",
    description: "Navigate pricing discussions and close deals with confidence",
    suggestion:
      '"They asked for 20% off. Counter with annual billing for 10% discount, keeping your margins intact."',
    mode: "Sales",
    category: "sales",
  },
  {
    id: "investor-pitch",
    title: "Investor Pitch",
    description:
      "Tell your startup story with compelling metrics and clear vision",
    suggestion:
      '"They asked about market size. Lead with the $4.2B TAM, then narrow to your $800M serviceable market."',
    mode: "Professional",
    category: "sales",
  },
  {
    id: "renewal-call",
    title: "Renewal Call",
    description:
      "Retain customers and identify upsell opportunities with value recaps",
    suggestion:
      '"Remind them of the 3 key wins this year before discussing renewal. Then introduce the enterprise tier."',
    mode: "Sales",
    category: "sales",
  },
  {
    id: "closing-call",
    title: "Closing Call",
    description:
      "Overcome final objections and secure commitment with proven techniques",
    suggestion:
      '"They said they need to think about it. Ask: What specific concerns would help you feel confident deciding today?"',
    mode: "Sales",
    category: "sales",
  },

  // MEETINGS (5)
  {
    id: "client-meeting",
    title: "Client Meeting",
    description:
      "Capture key points, action items, and follow-ups professionally",
    suggestion:
      '"They just agreed to the timeline. Summarize: Launch in Q2, weekly syncs starting Monday, you own the API integration."',
    mode: "Professional",
    category: "meetings",
  },
  {
    id: "board-meeting",
    title: "Board Meeting",
    description:
      "Present KPIs clearly and navigate strategic decisions with data",
    suggestion:
      '"The board seems concerned about burn rate. Pivot to the 18-month runway and the 3 revenue acceleration initiatives."',
    mode: "Professional",
    category: "meetings",
  },
  {
    id: "brainstorming",
    title: "Brainstorming Session",
    description:
      "Facilitate productive ideation and synthesize diverse perspectives",
    suggestion:
      '"Good ideas emerging but no structure. Suggest grouping by theme: product features, marketing angles, partnerships."',
    mode: "Default",
    category: "meetings",
  },
  {
    id: "manager-1on1",
    title: "Manager 1:1",
    description:
      "Navigate feedback conversations and career development discussions",
    suggestion:
      '"They asked about your career goals. Connect your recent project wins to the staff engineer track."',
    mode: "Professional",
    category: "meetings",
  },
  {
    id: "project-standup",
    title: "Project Standup",
    description:
      "Report status effectively and surface risks before they escalate",
    suggestion:
      '"Mention the API dependency blocker now. The team can unblock you if they know about it early."',
    mode: "Professional",
    category: "meetings",
  },

  // PRESENTATIONS (4)
  {
    id: "slide-presentation",
    title: "Slide Presentation",
    description: "Deliver key points clearly and handle Q&A with composure",
    suggestion:
      '"Tough question about the methodology. Acknowledge the limitation, then redirect to the strong results."',
    mode: "Professional",
    category: "presentations",
  },
  {
    id: "webinar-conference",
    title: "Webinar / Conference",
    description:
      "Engage remote audiences and manage timing across live sessions",
    suggestion:
      '"10 minutes left, 8 slides to go. Skip slides 15-16 (backup content) and go straight to the case study."',
    mode: "Professional",
    category: "presentations",
  },
  {
    id: "training-workshop",
    title: "Training / Workshop",
    description:
      "Teach effectively with interactive exercises and real-time feedback",
    suggestion:
      '"The group looks confused. Pause for a quick recap before the next exercise. Ask if anyone has questions."',
    mode: "Default",
    category: "presentations",
  },
  {
    id: "elevator-pitch",
    title: "Elevator Pitch",
    description:
      "Deliver a compelling 30-second hook with a clear call to action",
    suggestion:
      '"Focus on the problem first: Interview anxiety costs qualified candidates their dream jobs. Then your solution."',
    mode: "Sales",
    category: "presentations",
  },

  // EDUCATION (5)
  {
    id: "oral-examination",
    title: "Oral Examination",
    description:
      "Structure arguments clearly and maintain composure under pressure",
    suggestion:
      '"Take a breath. Start with your thesis statement, then the 3 supporting arguments you prepared."',
    mode: "Interview",
    category: "education",
  },
  {
    id: "thesis-defense",
    title: "Thesis Defense",
    description:
      "Defend your research confidently and handle jury questions gracefully",
    suggestion:
      '"They challenged your methodology. Acknowledge the tradeoff, explain why it was appropriate for this study."',
    mode: "Professional",
    category: "education",
  },
  {
    id: "language-exam",
    title: "Language Exam",
    description:
      "Navigate conversation portions with vocabulary and grammar support",
    suggestion:
      '"Use the conditional tense here: If I had more time, I would have explored... Shows grammatical range."',
    mode: "Default",
    category: "education",
  },
  {
    id: "professional-certification",
    title: "Professional Certification",
    description:
      "Tackle case studies and theory questions with structured answers",
    suggestion:
      '"For this PMP question, use the process group framework. Start with Initiating, then Planning..."',
    mode: "Interview",
    category: "education",
  },
  {
    id: "scholarship-interview",
    title: "Scholarship Interview",
    description:
      "Articulate your motivation and fit with compelling personal stories",
    suggestion:
      '"Connect your community service to your academic goals. Show how the scholarship enables your mission."',
    mode: "Interview",
    category: "education",
  },

  // PERSONAL (6)
  {
    id: "medical-appointment",
    title: "Medical Appointment",
    description:
      "Ask the right questions and understand treatment options clearly",
    suggestion:
      '"Good moment to ask about side effects and timeline. Also ask what happens if this treatment doesnt work."',
    mode: "Default",
    category: "personal",
  },
  {
    id: "administrative-call",
    title: "Administrative Call",
    description:
      "Navigate bureaucracy with knowledge of rights and procedures",
    suggestion:
      '"They said no, but you have the right to escalate. Ask for a supervisor or a reference number for the decision."',
    mode: "Default",
    category: "personal",
  },
  {
    id: "language-practice",
    title: "Language Practice",
    description:
      "Get real-time corrections and vocabulary suggestions as you speak",
    suggestion:
      '"Small correction: Use the subjunctive here - It is important that she BE on time, not is."',
    mode: "Default",
    category: "personal",
  },
  {
    id: "bank-insurance-call",
    title: "Bank / Insurance Call",
    description:
      "Negotiate rates and compare options with prepared counterarguments",
    suggestion:
      '"They offered 4.5% APR. Mention the 3.9% offer from the other bank. Ask if they can match it."',
    mode: "Professional",
    category: "personal",
  },
  {
    id: "rental-interview",
    title: "Rental Interview",
    description:
      "Present your file persuasively and stand out among applicants",
    suggestion:
      '"Highlight your 3 years at the same employer and spotless rental history. Offer an extra months deposit."',
    mode: "Professional",
    category: "personal",
  },
  {
    id: "conflict-mediation",
    title: "Conflict Mediation",
    description:
      "De-escalate tension with factual arguments and bridge-building language",
    suggestion:
      '"Pause. Acknowledge their frustration first: I understand this has been difficult. Then restate facts calmly."',
    mode: "Default",
    category: "personal",
  },
];

export const getCategoryById = (id: Category) =>
  categories.find((c) => c.id === id);

export const getUseCasesByCategory = (categoryId: Category) =>
  useCases.filter((uc) => uc.category === categoryId);
