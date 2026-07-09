const auth = require('./auth')

function normalizeImageUrl(url) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return auth.BASE_URL + url
}

function getCategoryKey(diagnosis) {
  if (!diagnosis) return 'unknown'
  if (diagnosis.category_code) return diagnosis.category_code
  if (diagnosis.category === '虫害') return 'pest'
  if (diagnosis.category === '病害') return 'disease'
  if (diagnosis.category === '生理性') return 'physiological'
  return 'unknown'
}

function getSeverityKey(diagnosis) {
  if (!diagnosis) return 'unknown'
  if (diagnosis.severity_code) return diagnosis.severity_code
  if (diagnosis.severity === '轻度') return 'light'
  if (diagnosis.severity === '中度') return 'medium'
  if (diagnosis.severity === '重度') return 'severe'
  return 'unknown'
}

function getConfidenceKey(diagnosis) {
  if (!diagnosis) return 'low'
  if (diagnosis.confidence_code) return diagnosis.confidence_code
  if (diagnosis.confidence === '高') return 'high'
  if (diagnosis.confidence === '中') return 'medium'
  return 'low'
}

function severityColor(key) {
  if (key === 'light') return '#2f8a52'
  if (key === 'medium') return '#d98222'
  if (key === 'severe') return '#d6453d'
  return '#6f7b72'
}

function treatDaysBySeverity(key) {
  if (key === 'severe') return 1
  if (key === 'medium') return 3
  if (key === 'light') return 5
  return '-'
}

function decorateHistoryRecord(record, copy) {
  const diagnosis = record && record.diagnosis ? record.diagnosis : null
  const categoryKey = getCategoryKey(diagnosis)
  const severityKey = getSeverityKey(diagnosis)
  return {
    ...record,
    image: normalizeImageUrl(record.image || record.localImage || ''),
    title: diagnosis && diagnosis.diagnosis_name ? diagnosis.diagnosis_name : (record.title || copy.pendingTitle),
    summary: diagnosis && diagnosis.summary ? diagnosis.summary : (record.summary || record.reply || ''),
    displayCategory: copy.categoryLabels[categoryKey] || copy.pendingCategory,
    displaySeverity: copy.severityLabels[severityKey] || copy.pendingSeverity
  }
}

function buildDiagnosisView(recognition, copy) {
  const diagnosis = recognition && recognition.diagnosis ? recognition.diagnosis : null

  if (!diagnosis) {
    const pest = {
      ...copy.pest,
      icon: '🧪',
      name: copy.aiResultTitle,
      type: copy.aiResultType,
      severity: copy.pendingSeverityValue,
      severityKey: 'unknown',
      severityColor: severityColor('unknown'),
      treatDays: copy.pendingTreatDays,
      desc: recognition && recognition.reply ? recognition.reply : copy.pendingSummary,
      treatments: [],
      products: []
    }

    return {
      pest,
      symptomList: [],
      evidenceList: [],
      confidence: copy.pendingConfidence,
      warning: '',
      severityTipText: copy.pendingSeverityTip
    }
  }

  const categoryKey = getCategoryKey(diagnosis)
  const severityKey = getSeverityKey(diagnosis)
  const confidenceKey = getConfidenceKey(diagnosis)

  const pest = {
    icon: categoryKey === 'pest' ? '🐛' : categoryKey === 'disease' ? '🍂' : categoryKey === 'physiological' ? '🌿' : '🧪',
    name: diagnosis.diagnosis_name || copy.pendingTitle,
    type: copy.categoryLabels[categoryKey] || copy.pendingCategory,
    severity: copy.severityLabels[severityKey] || copy.pendingSeverityValue,
    severityKey,
    severityColor: severityColor(severityKey),
    treatDays: treatDaysBySeverity(severityKey),
    desc: diagnosis.summary || recognition.reply || copy.pendingSummary,
    treatments: (Array.isArray(diagnosis.actions) ? diagnosis.actions : []).map((item, index) => ({
      n: `${copy.actionPrefix}${index + 1}`,
      d: item
    })),
    products: Array.isArray(diagnosis.products)
      ? diagnosis.products.map(item => ({
        name: item.name || copy.noProductName,
        price: item.usage || item.note || copy.noProductUsage,
        icon: '🧴'
      }))
      : []
  }

  return {
    pest,
    symptomList: Array.isArray(diagnosis.symptoms) ? diagnosis.symptoms : [],
    evidenceList: Array.isArray(diagnosis.evidence) ? diagnosis.evidence : [],
    confidence: copy.confidenceLabels[confidenceKey] || copy.pendingConfidence,
    warning: diagnosis.warning || '',
    severityTipText: severityKey === 'unknown' ? copy.pendingSeverityTip : copy.severityTip(pest.severity, pest.treatDays)
  }
}

module.exports = {
  normalizeImageUrl,
  getCategoryKey,
  getSeverityKey,
  getConfidenceKey,
  severityColor,
  treatDaysBySeverity,
  decorateHistoryRecord,
  buildDiagnosisView
}
