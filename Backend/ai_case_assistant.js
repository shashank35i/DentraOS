// AI Case Assistant for Dental Clinic
// ===================================

const CASE_TEMPLATES = {
  CONSULTATION: {
    summary: "Initial consultation completed for {patientName}. {findings} Patient education provided regarding treatment options.",
    recommendations: [
      "Schedule follow-up appointment within 2 weeks",
      "Provide written treatment plan with cost estimates",
      "Ensure patient understands all treatment options"
    ]
  },
  RESTORATIVE: {
    summary: "Restorative treatment in progress for {patientName}. {procedure} completed on tooth #{tooth}. {healing} noted.",
    recommendations: [
      "Monitor healing and tissue response",
      "Schedule crown/filling placement if temporary work done",
      "Advise patient on post-treatment care",
      "Consider night guard if bruxism signs present"
    ]
  },
  PERIODONTAL: {
    summary: "Periodontal therapy for {patientName}. {treatment} performed. Gingival health shows {improvement}.",
    recommendations: [
      "Schedule 3-month periodontal maintenance",
      "Recommend electric toothbrush and interdental aids",
      "Monitor pocket depths at recall appointments",
      "Consider referral to periodontist if severe"
    ]
  },
  ORTHODONTIC: {
    summary: "Orthodontic evaluation for {patientName}. {findings} Growth assessment indicates {timing} for intervention.",
    recommendations: [
      "Discuss treatment timeline with patient/parents",
      "Consider space maintainer vs active treatment",
      "Schedule growth monitoring appointments",
      "Provide oral hygiene instructions for braces"
    ]
  },
  SURGICAL: {
    summary: "Surgical procedure completed for {patientName}. {procedure} performed successfully. {healing} observed post-operatively.",
    recommendations: [
      "Prescribe appropriate pain management",
      "Schedule post-operative follow-up in 1 week",
      "Provide detailed post-surgical instructions",
      "Monitor for signs of infection or complications"
    ]
  },
  EMERGENCY: {
    summary: "Emergency treatment provided for {patientName}. {condition} addressed with {treatment}. Pain relief achieved.",
    recommendations: [
      "Schedule definitive treatment within 1-2 weeks",
      "Prescribe antibiotics if infection present",
      "Provide pain management instructions",
      "Ensure patient understands temporary nature of treatment"
    ]
  }
};

const RISK_FACTORS = {
  HIGH: [
    "Multiple failed appointments",
    "Complex medical history",
    "Poor oral hygiene compliance",
    "Financial constraints affecting treatment",
    "Multiple active infections",
    "Delayed healing patterns"
  ],
  MEDIUM: [
    "Moderate periodontal disease",
    "Occasional missed appointments",
    "Some compliance issues",
    "Minor medical considerations",
    "Moderate treatment complexity"
  ],
  LOW: [
    "Good oral hygiene",
    "Regular appointment attendance",
    "Healthy healing response",
    "Simple treatment needs",
    "Good patient compliance"
  ]
};

function generateCaseSummary(caseData) {
  const {
    patientName = "Patient",
    caseType = "CONSULTATION",
    procedures = [],
    findings = "",
    stage = "NEW",
    riskScore = 50,
    medicalHistory = "",
    lastVisitNotes = ""
  } = caseData;

  // Determine case template
  let templateKey = "CONSULTATION";
  if (caseType.includes("Restorative") || caseType.includes("Filling") || caseType.includes("Crown")) {
    templateKey = "RESTORATIVE";
  } else if (caseType.includes("Periodontal") || caseType.includes("Cleaning")) {
    templateKey = "PERIODONTAL";
  } else if (caseType.includes("Orthodontic") || caseType.includes("Braces")) {
    templateKey = "ORTHODONTIC";
  } else if (caseType.includes("Surgical") || caseType.includes("Extraction") || caseType.includes("Implant")) {
    templateKey = "SURGICAL";
  } else if (caseType.includes("Emergency")) {
    templateKey = "EMERGENCY";
  }

  const template = CASE_TEMPLATES[templateKey];

  // Generate contextual summary
  let summary = template.summary.replace("{patientName}", patientName);
  
  // Add procedure-specific details
  if (procedures.length > 0) {
    const procedureText = procedures.join(", ");
    summary = summary.replace("{procedure}", procedureText);
  } else {
    summary = summary.replace("{procedure}", "treatment");
  }

  // Add findings
  if (findings) {
    summary = summary.replace("{findings}", findings + " ");
  } else {
    summary = summary.replace("{findings}", "Clinical examination completed. ");
  }

  // Add healing status based on stage
  let healingStatus = "Initial assessment completed";
  if (stage === "IN_PROGRESS") {
    healingStatus = "treatment progressing well";
  } else if (stage === "COMPLETED") {
    healingStatus = "excellent healing response";
  } else if (stage === "WAITING_ON_PATIENT") {
    healingStatus = "awaiting patient follow-up";
  }
  summary = summary.replace("{healing}", healingStatus);
  summary = summary.replace("{improvement}", riskScore < 50 ? "significant improvement" : "gradual improvement");
  summary = summary.replace("{timing}", riskScore < 40 ? "optimal timing" : "appropriate timing");
  summary = summary.replace("{condition}", "acute condition");
  summary = summary.replace("{treatment}", "appropriate intervention");
  summary = summary.replace("{tooth}", Math.floor(Math.random() * 32) + 1);

  // Generate risk-based recommendations
  let riskLevel = "MEDIUM";
  if (riskScore >= 70) riskLevel = "HIGH";
  else if (riskScore <= 30) riskLevel = "LOW";

  let recommendations = [...template.recommendations];
  
  // Add risk-specific recommendations
  if (riskLevel === "HIGH") {
    recommendations.unshift("⚠️ HIGH PRIORITY: Requires immediate attention and close monitoring");
    recommendations.push("Consider more frequent follow-up appointments");
    recommendations.push("Discuss treatment compliance with patient");
  } else if (riskLevel === "LOW") {
    recommendations.push("✅ Patient shows excellent compliance and healing");
    recommendations.push("Continue with standard recall schedule");
  }

  // Add medical history considerations
  if (medicalHistory && medicalHistory.toLowerCase().includes("diabetes")) {
    recommendations.push("🩺 Monitor healing closely due to diabetes - may require extended healing time");
  }
  if (medicalHistory && medicalHistory.toLowerCase().includes("hypertension")) {
    recommendations.push("🩺 Blood pressure monitoring recommended for surgical procedures");
  }

  // Add stage-specific recommendations
  if (stage === "WAITING_ON_PATIENT") {
    recommendations.unshift("📞 URGENT: Contact patient to schedule required follow-up appointment");
  } else if (stage === "PLANNING") {
    recommendations.unshift("📋 Complete treatment planning and cost estimation");
  }

  return {
    summary: summary,
    recommendations: recommendations.slice(0, 6), // Limit to 6 recommendations
    riskLevel: riskLevel,
    clinicalTips: generateClinicalTips(templateKey, riskLevel),
    nextActions: generateNextActions(stage, riskLevel),
    confidence: Math.floor(Math.random() * 20) + 80 // 80-100% confidence for demo
  };
}

function generateClinicalTips(templateKey, riskLevel) {
  const tips = {
    CONSULTATION: [
      "💡 Use visual aids to explain treatment options",
      "📋 Document all findings thoroughly for insurance claims",
      "🗣️ Ensure patient understands treatment timeline and costs"
    ],
    RESTORATIVE: [
      "🔧 Check occlusion after composite placement",
      "💧 Maintain proper moisture control during bonding",
      "⏰ Allow adequate curing time for optimal bond strength"
    ],
    PERIODONTAL: [
      "🦷 Focus on patient education for home care",
      "📊 Document pocket depths for progress tracking",
      "🔄 Consider antimicrobial therapy for severe cases"
    ],
    ORTHODONTIC: [
      "📏 Take comprehensive records before treatment",
      "👨‍👩‍👧‍👦 Involve parents in treatment decisions for minors",
      "📅 Plan for growth spurts in adolescent patients"
    ],
    SURGICAL: [
      "🩸 Ensure adequate hemostasis before closure",
      "💊 Prescribe appropriate post-operative medications",
      "📞 Provide emergency contact information"
    ],
    EMERGENCY: [
      "⚡ Address pain relief as first priority",
      "🔍 Identify and treat underlying cause",
      "📋 Document emergency visit thoroughly"
    ]
  };

  let selectedTips = tips[templateKey] || tips.CONSULTATION;
  
  if (riskLevel === "HIGH") {
    selectedTips.push("⚠️ Consider specialist referral if complications arise");
  }

  return selectedTips.slice(0, 3);
}

function generateNextActions(stage, riskLevel) {
  const actions = {
    NEW: [
      "Complete comprehensive examination",
      "Take necessary radiographs",
      "Develop treatment plan",
      "Discuss treatment options with patient"
    ],
    PLANNING: [
      "Finalize treatment plan",
      "Provide cost estimate",
      "Schedule treatment appointments",
      "Obtain necessary pre-authorizations"
    ],
    IN_PROGRESS: [
      "Continue with planned treatment",
      "Monitor healing progress",
      "Adjust treatment as needed",
      "Schedule next appointment"
    ],
    WAITING_ON_PATIENT: [
      "Contact patient for follow-up",
      "Reschedule missed appointments",
      "Address any patient concerns",
      "Review treatment urgency"
    ],
    COMPLETED: [
      "Schedule routine follow-up",
      "Provide post-treatment instructions",
      "Document final results",
      "Plan maintenance schedule"
    ]
  };

  let stageActions = actions[stage] || actions.NEW;
  
  if (riskLevel === "HIGH") {
    stageActions = ["🚨 PRIORITY: " + stageActions[0], ...stageActions.slice(1)];
  }

  return stageActions.slice(0, 3);
}

// Generate sample AI summaries for existing cases
function generateSampleSummaries() {
  return [
    generateCaseSummary({
      patientName: "Ramchand Patnala",
      caseType: "Complex Restorative",
      procedures: ["Root Canal Therapy", "Crown Preparation"],
      findings: "Extensive caries on tooth #14 with pulpal involvement.",
      stage: "IN_PROGRESS",
      riskScore: 75,
      medicalHistory: "Hypertension controlled with medication"
    }),
    generateCaseSummary({
      patientName: "Patnala Ramchand", 
      caseType: "Periodontal Treatment",
      procedures: ["Scaling and Root Planing"],
      findings: "Moderate periodontal disease with 4-6mm pockets.",
      stage: "WAITING_ON_PATIENT",
      riskScore: 60,
      medicalHistory: "Diabetes Type 2, well controlled"
    }),
    generateCaseSummary({
      patientName: "Karthikeya",
      caseType: "Orthodontic Consultation", 
      procedures: ["Clinical Examination", "Radiographs"],
      findings: "Mild anterior crowding, Class I malocclusion.",
      stage: "NEW",
      riskScore: 25,
      medicalHistory: "No significant medical history"
    })
  ];
}

module.exports = {
  generateCaseSummary,
  generateSampleSummaries,
  CASE_TEMPLATES,
  RISK_FACTORS
};