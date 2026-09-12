'use client';

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// FuelBox brand colors - matches website theme
const BRAND = {
  green: '#16A34A',
  dark: '#111827',
  muted: '#6B7280',
  line: '#E5E7EB',
  lightBg: '#F9FAFB',
  amber: '#F59E0B',
};

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 32,
    paddingBottom: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: BRAND.dark,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: BRAND.green,
    paddingBottom: 12,
    marginBottom: 16,
  },
  brandLeft: {
    flexDirection: 'column',
  },
  brandName: {
    fontSize: 22,
    fontWeight: 700,
    color: BRAND.green,
    letterSpacing: 0.5,
  },
  brandSub: {
    fontSize: 8,
    color: BRAND.muted,
    marginTop: 2,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  headerDate: {
    fontSize: 8,
    color: BRAND.muted,
  },
  customerNameHero: {
    fontSize: 18,
    fontWeight: 700,
    color: BRAND.dark,
    marginBottom: 2,
    textTransform: 'capitalize',
  },
  customerPhoneHero: {
    fontSize: 9,
    color: BRAND.muted,
  },
  section: {
    marginTop: 14,
    marginBottom: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.green,
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 10,
    fontWeight: 700,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionSubHeader: {
    fontSize: 9,
    fontWeight: 700,
    color: BRAND.dark,
    backgroundColor: BRAND.lightBg,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderLeftWidth: 3,
    borderLeftColor: BRAND.green,
    marginTop: 10,
    marginBottom: 6,
  },
  grid2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  card: {
    flex: 1,
    minWidth: 120,
    backgroundColor: BRAND.lightBg,
    borderWidth: 1,
    borderColor: BRAND.line,
    borderRadius: 4,
    padding: 8,
  },
  cardLabel: {
    fontSize: 7,
    fontWeight: 700,
    color: BRAND.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  cardValue: {
    fontSize: 9,
    fontWeight: 700,
    color: BRAND.dark,
  },
  cardValueSmall: {
    fontSize: 8,
    color: BRAND.muted,
    marginTop: 1,
  },
  table: {
    borderWidth: 1,
    borderColor: BRAND.line,
    borderRadius: 4,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: BRAND.dark,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    fontSize: 7,
    fontWeight: 700,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.line,
    minHeight: 18,
  },
  tableRowAlt: {
    backgroundColor: BRAND.lightBg,
  },
  tableCell: {
    fontSize: 8,
    color: BRAND.dark,
  },
  tableCellBold: {
    fontSize: 8,
    fontWeight: 700,
    color: BRAND.dark,
  },
  tableCellMuted: {
    fontSize: 7,
    color: BRAND.muted,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 7,
    fontWeight: 700,
    textAlign: 'center',
  },
  summaryBox: {
    backgroundColor: BRAND.lightBg,
    borderWidth: 1,
    borderColor: BRAND.line,
    borderRadius: 4,
    padding: 10,
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  summaryLabel: {
    fontSize: 8,
    color: BRAND.muted,
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 9,
    fontWeight: 700,
    color: BRAND.dark,
  },
  summaryValueOutstanding: {
    fontSize: 10,
    fontWeight: 700,
    color: '#DC2626',
  },
  summaryValuePaid: {
    fontSize: 10,
    fontWeight: 700,
    color: BRAND.green,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: BRAND.green,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 3,
    marginTop: 8,
    marginBottom: 4,
  },
  dayHeaderText: {
    fontSize: 9,
    fontWeight: 700,
    color: '#FFFFFF',
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#EEF2FF',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 3,
    marginTop: 6,
    marginBottom: 3,
  },
  mealHeaderText: {
    fontSize: 8,
    fontWeight: 700,
    color: '#3730A3',
    textTransform: 'uppercase',
  },
  foodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F3F4F6',
  },
  foodName: {
    fontSize: 8,
    color: BRAND.dark,
    flex: 1,
  },
  foodQty: {
    fontSize: 8,
    color: BRAND.muted,
    fontWeight: 700,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 32,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: BRAND.line,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: BRAND.muted,
  },
  pageNumber: {
    fontSize: 7,
    color: BRAND.muted,
  },
  emptyText: {
    fontSize: 8,
    color: BRAND.muted,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
});

function formatINR(amount: any): string {
  const n = Number(amount) || 0;
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr: any): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(dateStr);
  }
}

function safeStr(v: any, fallback = '-'): string {
  if (v === null || v === undefined || v === '') return fallback;
  return String(v);
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEAL_DISPLAY: Record<string, string> = {
  Morning: 'Breakfast',
  Afternoon: 'Lunch',
  Evening: 'Snacks',
  Night: 'Dinner',
};

function getMealDisplayName(name: string): string {
  return MEAL_DISPLAY[name] || name;
}

export interface CustomerPdfProps {
  customer: any;
  enquiry?: any;
  subscription?: any;
  deliveries?: any[];
  generatedAt?: string;
}

export function CustomerPdf({ customer, enquiry, subscription, deliveries, generatedAt }: CustomerPdfProps) {
  // Use latest data - prefer enquiry over customer for fields that may be updated
  const c = enquiry || customer || {};
  const sub = subscription || null;

  const customerName = safeStr(c.customer_name || c.name || customer?.name || 'Customer');
  const gender = safeStr(c.gender || customer?.gender || '-', '-');
  const height = c.height ? `${c.height} cm` : '-';
  const weight = c.weight ? `${c.weight} kg` : '-';
  const foodPref = safeStr(c.food_preference || c.food || customer?.food || '-', '-').replace(/_/g, ' ');

  const planName = safeStr(
    c.meal_plan_packages && Array.isArray(c.meal_plan_packages) && c.meal_plan_packages.length > 0
      ? c.meal_plan_packages.map((p: any) => p.name).join(', ')
      : sub?.duration_days ? `${sub.duration_days} Days Plan` : c.meals_per_day ? `${c.meals_per_day} Meals/Day` : '-',
    '-'
  );
  const duration = sub?.duration_days ? `${sub.duration_days} Days` : c.meals_per_day ? `${c.meals_per_day} meals/day` : '-';
  const startDate = formatDate(sub?.start_date || c.enquiry_date || c.created_at);
  const endDate = formatDate(
    sub?.actual_end_date ||
      (sub?.start_date && sub?.duration_days
        ? new Date(new Date(sub.start_date).getTime() + (sub.duration_days - 1 + (sub.paused_days || 0)) * 86400000).toISOString().split('T')[0]
        : '-')
  );
  const subStatus = safeStr(sub?.status || c.order_status || c.sales_status || 'Active', 'Active').replace(/_/g, ' ');

  const totalBill = c.total_amount ?? customer?.meal_plan_price ?? 0;
  const amountPaid = c.paid_amount ?? 0;
  const outstanding = c.outstanding_amount ?? Math.max(0, Number(totalBill) - Number(amountPaid));
  const paymentStatus = safeStr(c.payment_status || 'pending', 'pending').replace(/_/g, ' ');
  const paymentMethod = safeStr(c.payment_method || '-', '-');
  const paymentDate = c.payment_date ? formatDate(c.payment_date) : '-';
  const paymentHistory = Array.isArray(c.payment_history) ? c.payment_history : [];

  // Meal plan handling - support both 7-day per-day array and legacy meals array
  const rawMealPlan = c.meal_plan || customer?.meal_plan || [];
  let is7Day = false;
  let days: any[] = [];

  if (Array.isArray(rawMealPlan) && rawMealPlan.length > 0 && (rawMealPlan[0] as any)?.day && Array.isArray((rawMealPlan[0] as any)?.meals)) {
    is7Day = true;
    days = (rawMealPlan as any[]).slice(0, 7).map((d: any, idx: number) => ({
      dayNum: d.day || idx + 1,
      dayName: WEEKDAYS[(d.day ? d.day - 1 : idx) % 7] || `Day ${d.day || idx + 1}`,
      date: d.date && d.date !== '-' ? formatDate(d.date) : '',
      meals: Array.isArray(d.meals) ? d.meals : [],
    }));
  } else if (Array.isArray(rawMealPlan) && rawMealPlan.length > 0 && (rawMealPlan[0] as any)?.name) {
    // legacy: array of meals (Morning, Afternoon, Night)
    const meals = rawMealPlan as any[];
    days = [
      {
        dayNum: 1,
        dayName: 'Daily Plan',
        date: '',
        meals: meals.map((m: any) => ({
          name: m.name,
          items: Array.isArray(m.items) ? m.items : [],
          total_calories: m.total_calories || 0,
        })),
      },
    ];
  } else if (rawMealPlan && typeof rawMealPlan === 'object' && Array.isArray((rawMealPlan as any).meals)) {
    const meals = (rawMealPlan as any).meals;
    days = [
      {
        dayNum: 1,
        dayName: 'Daily Plan',
        date: '',
        meals,
      },
    ];
  }

  const hasMeals = days.length > 0 && days.some((d) => d.meals && d.meals.length > 0);

  const generatedDate = generatedAt || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandLeft}>
            <Text style={styles.brandName}>FuelBox</Text>
            <Text style={styles.brandSub}>Premium Meal Subscription • Coimbatore</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerDate}>Generated: {generatedDate}</Text>
            <Text style={styles.headerDate}>Customer Summary</Text>
          </View>
        </View>

        {/* Customer Name Hero */}
        <Text style={styles.customerNameHero}>{customerName}</Text>
        <Text style={styles.customerPhoneHero}>
          {safeStr(c.phone || customer?.phone, '')} {c.email ? `• ${c.email}` : ''} {c.address ? `• ${c.address}` : ''}
        </Text>

        {/* 1. Customer Details */}
        <View style={styles.section} wrap={false}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>1. Customer Details</Text>
          </View>
          <View style={styles.grid2}>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Customer Name</Text>
              <Text style={styles.cardValue}>{customerName}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Gender</Text>
              <Text style={[styles.cardValue, { textTransform: 'capitalize' }]}>{gender}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Height</Text>
              <Text style={styles.cardValue}>{height}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Weight</Text>
              <Text style={styles.cardValue}>{weight}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Food Preference</Text>
              <Text style={[styles.cardValue, { textTransform: 'capitalize' }]}>{foodPref}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Phone</Text>
              <Text style={styles.cardValue}>{safeStr(c.phone || customer?.phone, '-')}</Text>
            </View>
          </View>
          {c.age && (
            <View style={[styles.grid2, { marginTop: 8 }]}>
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Age</Text>
                <Text style={styles.cardValue}>{c.age} years</Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Goal</Text>
                <Text style={[styles.cardValue, { textTransform: 'capitalize' }]}>{safeStr(c.goal, '-').replace(/_/g, ' ')}</Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Activity Level</Text>
                <Text style={[styles.cardValue, { textTransform: 'capitalize' }]}>{safeStr(c.activity_level || c.activity, '-').replace(/_/g, ' ')}</Text>
              </View>
            </View>
          )}
        </View>

        {/* 2. Subscription Details */}
        <View style={styles.section} wrap={false}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>2. Subscription Details</Text>
          </View>
          <View style={styles.grid2}>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Subscription Plan</Text>
              <Text style={styles.cardValue}>{planName}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Subscription Duration</Text>
              <Text style={styles.cardValue}>{duration}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Start Date</Text>
              <Text style={styles.cardValue}>{startDate}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>End Date</Text>
              <Text style={styles.cardValue}>{endDate}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Subscription Status</Text>
              <Text style={[styles.cardValue, { textTransform: 'capitalize' }]}>{subStatus}</Text>
              {sub?.auto_renew && (
                <Text style={[styles.cardValueSmall, { color: BRAND.green, fontWeight: 700 }]}>Auto-renew ON • {sub.auto_renew_days || ''} days</Text>
              )}
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Meals Per Day</Text>
              <Text style={styles.cardValue}>{c.meals_per_day || sub?.customer?.meals_per_day || '-'}</Text>
            </View>
          </View>
        </View>

        {/* 3. Selected Meals / Food */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>3. Selected Meals & Food Items {is7Day ? '(7-Day Plan)' : ''}</Text>
          </View>
          {!hasMeals ? (
            <Text style={styles.emptyText}>No meal plan selected</Text>
          ) : (
            days.map((day, dayIdx) => (
              <View key={dayIdx} wrap={false} style={{ marginBottom: 6 }}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayHeaderText}>
                    {day.dayName} {day.dayNum ? `• Day ${day.dayNum}` : ''} {day.date ? `• ${day.date}` : ''}
                  </Text>
                  <Text style={styles.dayHeaderText}>
                    {day.meals.reduce((s: number, m: any) => s + (m.items?.length || 0), 0)} items •{' '}
                    {day.meals.reduce((s: number, m: any) => s + (m.total_calories || m.items?.reduce((a: any, it: any) => a + (it.calories || 0), 0) || 0), 0)} kcal
                  </Text>
                </View>
                {day.meals.map((meal: any, mealIdx: number) => (
                  <View key={mealIdx} style={{ marginBottom: 2 }}>
                    <View style={styles.mealHeader}>
                      <Text style={styles.mealHeaderText}>{getMealDisplayName(meal.name)}</Text>
                      <Text style={[styles.mealHeaderText, { fontSize: 7, color: BRAND.muted }]}>
                        {meal.items?.reduce((s: number, it: any) => s + (it.calories || 0), 0) || 0} kcal
                      </Text>
                    </View>
                    {meal.items && meal.items.length > 0 ? (
                      <View style={{ borderWidth: 1, borderColor: BRAND.line, borderRadius: 3 }}>
                        {/* Table header for foods */}
                        <View style={{ flexDirection: 'row', backgroundColor: BRAND.lightBg, paddingVertical: 3, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: BRAND.line }}>
                          <Text style={{ flex: 3, fontSize: 6, fontWeight: 700, color: BRAND.muted, textTransform: 'uppercase' }}>Food Item</Text>
                          <Text style={{ flex: 1, fontSize: 6, fontWeight: 700, color: BRAND.muted, textAlign: 'right', textTransform: 'uppercase' }}>Qty</Text>
                          <Text style={{ flex: 1, fontSize: 6, fontWeight: 700, color: BRAND.muted, textAlign: 'right', textTransform: 'uppercase' }}>Calories</Text>
                        </View>
                        {meal.items.map((it: any, idx: number) => (
                          <View key={idx} style={[styles.foodRow, idx % 2 === 1 ? { backgroundColor: '#F9FAFB' } : {}]}>
                            <Text style={styles.foodName}>{it.name || it.id || '-'}</Text>
                            <Text style={styles.foodQty}>{it.grams ? `${it.grams}g` : it.g ? `${it.g}g` : '-'}</Text>
                            <Text style={[styles.foodQty, { textAlign: 'right' }]}>{it.calories ? `${it.calories} kcal` : '-'}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={[styles.emptyText, { paddingVertical: 4 }]}>No foods for {getMealDisplayName(meal.name)}</Text>
                    )}
                  </View>
                ))}
              </View>
            ))
          )}
        </View>

        {/* 4. Payment / Billing Details */}
        <View style={styles.section} wrap={false}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>4. Payment & Billing Details</Text>
          </View>
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Bill Amount</Text>
              <Text style={styles.summaryValue}>{formatINR(totalBill)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount Paid</Text>
              <Text style={styles.summaryValuePaid}>{formatINR(amountPaid)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Outstanding Amount</Text>
              <Text style={styles.summaryValueOutstanding}>{formatINR(outstanding)}</Text>
            </View>
            <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: BRAND.line, marginTop: 6, paddingTop: 6 }]}>
              <Text style={styles.summaryLabel}>Payment Status</Text>
              <Text style={[styles.summaryValue, { textTransform: 'capitalize', color: paymentStatus.includes('paid') && !paymentStatus.includes('partial') ? BRAND.green : paymentStatus.includes('partial') ? '#D97706' : '#DC2626' }]}>
                {paymentStatus}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Payment Method</Text>
              <Text style={[styles.summaryValue, { textTransform: 'capitalize' }]}>{paymentMethod}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Payment Date</Text>
              <Text style={styles.summaryValue}>{paymentDate}</Text>
            </View>
          </View>

          {paymentHistory.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.sectionSubHeader}>Payment History</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Date</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Amount</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Method</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Note</Text>
                </View>
                {paymentHistory.slice(0, 10).map((h: any, idx: number) => (
                  <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
                    <Text style={[styles.tableCell, { flex: 1 }]}>{formatDate(h.date)}</Text>
                    <Text style={[styles.tableCellBold, { flex: 1 }]}>{formatINR(h.amount)}</Text>
                    <Text style={[styles.tableCell, { flex: 1, textTransform: 'capitalize' }]}>{h.method || '-'}</Text>
                    <Text style={[styles.tableCellMuted, { flex: 2 }]}>{h.note || '-'}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={{ marginTop: 8, padding: 8, backgroundColor: '#EFF6FF', borderRadius: 4, borderWidth: 1, borderColor: '#BFDBFE' }}>
            <Text style={{ fontSize: 7, color: '#1E40AF', textAlign: 'center' }}>
              Thank you for choosing FuelBox • Eat clean, stay fueled • For queries contact support • Generated: {generatedDate}
            </Text>
          </View>
        </View>

        {/* Footer - Page numbers */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>FuelBox • Premium Meal Subscription • fuelbox.co.in</Text>
          <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
        </View>
      </Page>
    </Document>
  );
}

export default CustomerPdf;
