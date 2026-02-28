import React, { useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  useColorScheme,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/theme';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
const FEATURES = [
  { icon: 'calendar-outline' as const, title: 'Discover Events', desc: 'Cultural performances, festivals, food fairs and workshops happening in your city.' },
  { icon: 'people-outline' as const, title: 'Join Communities', desc: 'Connect with your diaspora community — reunions, cultural societies and social groups.' },
  { icon: 'gift-outline' as const, title: 'Exclusive Perks', desc: 'Member discounts and priority access at local cultural businesses and venues.' },
  { icon: 'map-outline' as const, title: 'Cultural Map', desc: 'Browse venues, restaurants and cultural spots on an interactive city map.' },
  { icon: 'star-outline' as const, title: 'CulturePass Membership', desc: 'Plus & Elite tiers with premium access, early booking and curated picks.' },
  { icon: 'storefront-outline' as const, title: 'Business Directory', desc: 'Support and discover authentic cultural businesses near you.' },
];

const CITIES = [
  { name: 'Sydney',    color: ['#0081C8', '#004F8A'] as [string, string] },
  { name: 'Melbourne', color: ['#EE334E', '#9B1A2E'] as [string, string] },
  { name: 'Brisbane',  color: ['#FCB131', '#C47D00'] as [string, string] },
  { name: 'Perth',     color: ['#00A651', '#006B35'] as [string, string] },
  { name: 'Adelaide',  color: ['#9B59B6', '#6C3483'] as [string, string] },
  { name: 'Canberra',  color: ['#E74C3C', '#922B21'] as [string, string] },
  { name: 'Darwin',    color: ['#2E86C1', '#1B4F72'] as [string, string] },
  { name: 'Hobart',    color: ['#17A589', '#0E6655'] as [string, string] },
];

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    accent: '#8E8E93',
    features: ['Discover public events', 'Browse communities', 'Cultural map access', 'Basic business directory'],
    cta: 'Get Started Free',
  },
  {
    name: 'Plus',
    price: '$9.99',
    period: 'per month',
    accent: '#0081C8',
    features: ['Everything in Free', 'Member perks & discounts', 'Priority event booking', 'Community messaging', 'Early access to events'],
    cta: 'Start Plus',
    highlight: true,
  },
  {
    name: 'Elite',
    price: '$19.99',
    period: 'per month',
    accent: '#FCB131',
    features: ['Everything in Plus', 'Curated monthly picks', 'VIP venue access', 'Exclusive events', 'Dedicated support'],
    cta: 'Go Elite',
  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
type AnyRef = React.RefObject<any>;

function NavBar({ isDesktop, featuresRef, citiesRef, pricingRef, scrollRef }: {
  isDesktop: boolean;
  featuresRef: AnyRef;
  citiesRef: AnyRef;
  pricingRef: AnyRef;
  scrollRef: AnyRef;
}) {
  const scrollTo = (ref: AnyRef) => {
    ref.current?.measureInWindow((_x: number, y: number) => {
      scrollRef.current?.scrollTo({ y, animated: true });
    });
  };

  return (
    <View style={[navStyles.bar, isDesktop && navStyles.barDesktop]}>
      <View style={navStyles.logoRow}>
        <View style={navStyles.logoIcon}>
          <Ionicons name="globe-outline" size={20} color="#fff" />
        </View>
        <View>
          <Text style={navStyles.logoText}>CulturePass</Text>
          <Text style={navStyles.logoUrl}>CulturePass.App</Text>
        </View>
      </View>

      {isDesktop && (
        <View style={navStyles.links}>
          <Pressable onPress={() => scrollTo(featuresRef)}>
            <Text style={navStyles.link}>Features</Text>
          </Pressable>
          <Pressable onPress={() => scrollTo(citiesRef)}>
            <Text style={navStyles.link}>Cities</Text>
          </Pressable>
          <Pressable onPress={() => scrollTo(pricingRef)}>
            <Text style={navStyles.link}>Pricing</Text>
          </Pressable>
        </View>
      )}

      <View style={navStyles.ctaRow}>
        <Pressable style={navStyles.ghostBtn} onPress={() => router.push('/(onboarding)/login')}>
          <Text style={navStyles.ghostBtnText}>Sign In</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/(onboarding)/signup')}>
          <LinearGradient colors={['#0081C8', '#EE334E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={navStyles.primaryBtn}>
            <Text style={navStyles.primaryBtnText}>Get Started</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function FeatureCard({ icon, title, desc, isDark }: { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string; isDark: boolean }) {
  return (
    <View style={[featureStyles.card, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }]}>
      <View style={featureStyles.iconCircle}>
        <Ionicons name={icon} size={24} color={Colors.primary} />
      </View>
      <Text style={[featureStyles.title, { color: isDark ? '#E8F4FF' : '#001628' }]}>{title}</Text>
      <Text style={[featureStyles.desc, { color: isDark ? 'rgba(232,244,255,0.6)' : 'rgba(0,22,40,0.6)' }]}>{desc}</Text>
    </View>
  );
}

function CityCard({ name, color }: { name: string; color: [string, string] }) {
  return (
    <LinearGradient colors={color} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={cityStyles.card}>
      <Text style={cityStyles.name}>{name}</Text>
      <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.8)" />
    </LinearGradient>
  );
}

function TierCard({ tier, isDark }: { tier: typeof TIERS[number]; isDark: boolean }) {
  return (
    <View style={[tierStyles.card,
      tier.highlight && tierStyles.cardHighlight,
      { backgroundColor: isDark ? (tier.highlight ? 'rgba(0,129,200,0.15)' : 'rgba(255,255,255,0.05)') : (tier.highlight ? 'rgba(0,129,200,0.08)' : '#fff') },
      { borderColor: tier.highlight ? tier.accent : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)') },
    ]}>
      {tier.highlight && (
        <View style={tierStyles.badge}>
          <Text style={tierStyles.badgeText}>Most Popular</Text>
        </View>
      )}
      <Text style={[tierStyles.tierName, { color: tier.accent }]}>{tier.name}</Text>
      <View style={tierStyles.priceRow}>
        <Text style={[tierStyles.price, { color: isDark ? '#E8F4FF' : '#001628' }]}>{tier.price}</Text>
        <Text style={[tierStyles.period, { color: isDark ? 'rgba(232,244,255,0.5)' : 'rgba(0,22,40,0.5)' }]}>/{tier.period}</Text>
      </View>
      {tier.features.map((f) => (
        <View key={f} style={tierStyles.featureRow}>
          <Ionicons name="checkmark-circle" size={16} color={tier.accent} />
          <Text style={[tierStyles.featureText, { color: isDark ? 'rgba(232,244,255,0.8)' : 'rgba(0,22,40,0.8)' }]}>{f}</Text>
        </View>
      ))}
      <Pressable onPress={() => router.push('/(onboarding)/signup')} style={{ marginTop: 20 }}>
        <LinearGradient
          colors={tier.highlight ? ['#0081C8', '#EE334E'] : [tier.accent, tier.accent]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={tierStyles.cta}
        >
          <Text style={tierStyles.ctaText}>{tier.cta}</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Landing / Get-to-Know Page
// ---------------------------------------------------------------------------
export default function Get2KnowPage() {
  const { width } = useWindowDimensions();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && !isDesktop;

  const scrollRef = useRef<ScrollView>(null);
  const featuresRef = useRef<View>(null);
  const citiesRef = useRef<View>(null);
  const pricingRef = useRef<View>(null);

  const hPad = isDesktop ? 80 : isTablet ? 40 : 20;
  const maxContentWidth = isDesktop ? 1200 : isTablet ? 860 : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#01050D' : '#F8FBFF' }}>
      <NavBar
        isDesktop={isDesktop}
        featuresRef={featuresRef}
        citiesRef={citiesRef}
        pricingRef={pricingRef}
        scrollRef={scrollRef}
      />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
      >
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <LinearGradient
          colors={['#001F4D', '#0081C8', '#EE334E', '#FCB131']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={heroStyles.hero}
        >
          <View style={[heroStyles.content, { paddingHorizontal: hPad, maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' }]}>
            <View style={heroStyles.badge}>
              <Ionicons name="flag-outline" size={14} color="#FCB131" />
              <Text style={heroStyles.badgeText}>All Australian States &amp; Territories</Text>
            </View>

            <Text style={[heroStyles.headline, isDesktop && heroStyles.headlineDesktop]}>
              Your Cultural Passport{'\n'}to Australia
            </Text>
            <Text style={[heroStyles.sub, isDesktop && heroStyles.subDesktop]}>
              Discover events, join communities, and celebrate culture across Sydney,
              Melbourne, Brisbane and every corner of Australia.
            </Text>

            <View style={heroStyles.ctaRow}>
              <Pressable onPress={() => router.push('/(onboarding)/signup')}>
                <View style={heroStyles.primaryCta}>
                  <Text style={heroStyles.primaryCtaText}>Get Started — Free</Text>
                  <Ionicons name="arrow-forward" size={16} color="#001F4D" />
                </View>
              </Pressable>
              <Pressable onPress={() => router.push('/(onboarding)/login')}>
                <View style={heroStyles.ghostCta}>
                  <Text style={heroStyles.ghostCtaText}>Sign In</Text>
                </View>
              </Pressable>
            </View>

            {/* Floating event card mockups */}
            {isDesktop && (
              <View style={heroStyles.mockupRow}>
                {[
                  { title: 'Lunar New Year Gala', city: 'Sydney', date: 'Sat 15 Feb', color: ['#0081C8', '#004F8A'] as [string, string] },
                  { title: 'Diwali Night Market', city: 'Melbourne', date: 'Fri 21 Feb', color: ['#EE334E', '#9B1A2E'] as [string, string] },
                  { title: 'Afrobeats Festival', city: 'Brisbane', date: 'Sun 23 Feb', color: ['#FCB131', '#C47D00'] as [string, string] },
                ].map((card) => (
                  <LinearGradient key={card.title} colors={card.color} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={heroStyles.mockupCard}>
                    <Text style={heroStyles.mockupDate}>{card.date}</Text>
                    <Text style={heroStyles.mockupTitle}>{card.title}</Text>
                    <Text style={heroStyles.mockupCity}>{card.city}</Text>
                  </LinearGradient>
                ))}
              </View>
            )}
          </View>
        </LinearGradient>

        {/* ── Stats bar ─────────────────────────────────────────────────── */}
        <View style={[statsStyles.bar, { backgroundColor: isDark ? '#091525' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
          {[
            { value: '8', label: 'Cities' },
            { value: '500+', label: 'Events/Month' },
            { value: '50+', label: 'Communities' },
            { value: '1000+', label: 'Members' },
          ].map((stat, i) => (
            <React.Fragment key={stat.label}>
              {i > 0 && <View style={[statsStyles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]} />}
              <View style={statsStyles.stat}>
                <Text style={[statsStyles.value, { color: Colors.primary }]}>{stat.value}</Text>
                <Text style={[statsStyles.label, { color: isDark ? 'rgba(232,244,255,0.6)' : 'rgba(0,22,40,0.6)' }]}>{stat.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* ── Features ──────────────────────────────────────────────────── */}
        <View ref={featuresRef} style={[sectionStyles.section, { paddingHorizontal: hPad }]}>
          <View style={[sectionStyles.inner, maxContentWidth ? { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' } : {}]}>
            <Text style={[sectionStyles.eyebrow, { color: Colors.primary }]}>Features</Text>
            <Text style={[sectionStyles.heading, { color: isDark ? '#E8F4FF' : '#001628' }]}>
              Everything you need to{'\n'}celebrate your culture
            </Text>
            <View style={[featureStyles.grid, isDesktop && featureStyles.gridDesktop, isTablet && featureStyles.gridTablet]}>
              {FEATURES.map((f) => (
                <FeatureCard key={f.title} {...f} isDark={isDark} />
              ))}
            </View>
          </View>
        </View>

        {/* ── Cities ────────────────────────────────────────────────────── */}
        <View ref={citiesRef} style={[sectionStyles.section, { backgroundColor: isDark ? '#060B14' : '#F0F4FF', paddingHorizontal: hPad }]}>
          <View style={[sectionStyles.inner, maxContentWidth ? { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' } : {}]}>
            <Text style={[sectionStyles.eyebrow, { color: Colors.primary }]}>Available In</Text>
            <Text style={[sectionStyles.heading, { color: isDark ? '#E8F4FF' : '#001628' }]}>
              All States &amp;{'\n'}Territories of Australia
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={cityStyles.scroll}>
              {CITIES.map((c) => (
                <CityCard key={c.name} {...c} />
              ))}
            </ScrollView>
          </View>
        </View>

        {/* ── Pricing ───────────────────────────────────────────────────── */}
        <View ref={pricingRef} style={[sectionStyles.section, { paddingHorizontal: hPad }]}>
          <View style={[sectionStyles.inner, maxContentWidth ? { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' } : {}]}>
            <Text style={[sectionStyles.eyebrow, { color: Colors.primary }]}>Membership</Text>
            <Text style={[sectionStyles.heading, { color: isDark ? '#E8F4FF' : '#001628' }]}>
              Simple, transparent{'\n'}pricing
            </Text>
            <View style={[tierStyles.grid, isDesktop && tierStyles.gridDesktop]}>
              {TIERS.map((t) => (
                <TierCard key={t.name} tier={t} isDark={isDark} />
              ))}
            </View>
          </View>
        </View>

        {/* ── CTA Banner ────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: hPad, marginBottom: 24 }}>
          <LinearGradient
            colors={['#0081C8', '#EE334E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={ctaStyles.banner}
          >
            <Text style={ctaStyles.bannerTitle}>Start your cultural journey today</Text>
            <Text style={ctaStyles.bannerSub}>Free forever. No credit card required.</Text>
            <Pressable onPress={() => router.push('/(onboarding)/signup')} style={ctaStyles.bannerBtn}>
              <Text style={ctaStyles.bannerBtnText}>Create Free Account</Text>
              <Ionicons name="arrow-forward" size={16} color="#0081C8" />
            </Pressable>
          </LinearGradient>
        </View>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <View style={[footerStyles.footer, { borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', paddingHorizontal: hPad }]}>
          <View style={[footerStyles.inner, maxContentWidth ? { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' } : {}]}>
            <View style={footerStyles.brand}>
              <View style={navStyles.logoRow}>
                <View style={[navStyles.logoIcon, { backgroundColor: Colors.primary }]}>
                  <Ionicons name="globe-outline" size={16} color="#fff" />
                </View>
                <View>
                  <Text style={[navStyles.logoText, { color: isDark ? '#E8F4FF' : '#001628' }]}>CulturePass</Text>
                  <Text style={[navStyles.logoUrl, { color: isDark ? '#E8F4FF' : '#001628' }]}>CulturePass.App</Text>
                </View>
              </View>
              <Text style={[footerStyles.tagline, { color: isDark ? 'rgba(232,244,255,0.5)' : 'rgba(0,22,40,0.5)' }]}>
                Celebrating culture, connecting communities.
              </Text>
            </View>

            {isDesktop && (
              <View style={footerStyles.cols}>
                {[
                  { heading: 'Product', items: ['Features', 'Cities', 'Pricing', 'Membership'] },
                  { heading: 'Company', items: ['About', 'Blog', 'Careers', 'Press'] },
                  { heading: 'Support', items: ['Help Centre', 'Contact', 'Privacy', 'Terms'] },
                ].map((col) => (
                  <View key={col.heading} style={footerStyles.col}>
                    <Text style={[footerStyles.colHeading, { color: isDark ? '#E8F4FF' : '#001628' }]}>{col.heading}</Text>
                    {col.items.map((item) => (
                      <Text key={item} style={[footerStyles.colItem, { color: isDark ? 'rgba(232,244,255,0.5)' : 'rgba(0,22,40,0.5)' }]}>{item}</Text>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </View>

          <Text style={[footerStyles.copy, { color: isDark ? 'rgba(232,244,255,0.35)' : 'rgba(0,22,40,0.35)' }]}>
            © 2025 CulturePass AU. All rights reserved.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const navStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,31,77,0.97)',
  },
  barDesktop: { paddingHorizontal: 80 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#0081C8', alignItems: 'center', justifyContent: 'center',
  },
  logoText: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: '#fff' },
  logoUrl: { fontSize: 10, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.8)' },
  links: { flexDirection: 'row', gap: 32 },
  link: { fontSize: 14, fontFamily: 'Poppins_500Medium', color: 'rgba(255,255,255,0.8)' },
  ctaRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  ghostBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  ghostBtnText: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  primaryBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8 },
  primaryBtnText: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
});

const heroStyles = StyleSheet.create({
  hero: { paddingTop: 80, paddingBottom: 70 },
  content: { gap: 0 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', backgroundColor: 'rgba(252,177,49,0.15)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(252,177,49,0.3)', marginBottom: 24,
  },
  badgeText: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: '#FCB131' },
  headline: {
    fontSize: 40, fontFamily: 'Poppins_700Bold', color: '#fff',
    lineHeight: 50, marginBottom: 20,
  },
  headlineDesktop: { fontSize: 62, lineHeight: 74 },
  sub: {
    fontSize: 16, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.85)',
    lineHeight: 26, maxWidth: 520, marginBottom: 36,
  },
  subDesktop: { fontSize: 20, lineHeight: 32 },
  ctaRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 48 },
  primaryCta: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FCB131', borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 14,
  },
  primaryCtaText: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: '#001F4D' },
  ghostCta: {
    borderRadius: 12, paddingHorizontal: 24, paddingVertical: 13,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
  },
  ghostCtaText: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  mockupRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  mockupCard: {
    flex: 1, borderRadius: 16, padding: 20,
    minHeight: 130,
  },
  mockupDate: { fontSize: 11, fontFamily: 'Poppins_500Medium', color: 'rgba(255,255,255,0.7)', marginBottom: 6 },
  mockupTitle: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: '#fff', marginBottom: 6 },
  mockupCity: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.8)' },
});

const statsStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingVertical: 28, borderTopWidth: 1, borderBottomWidth: 1,
  },
  stat: { alignItems: 'center', gap: 4 },
  value: { fontSize: 28, fontFamily: 'Poppins_700Bold' },
  label: { fontSize: 13, fontFamily: 'Poppins_400Regular' },
  divider: { width: 1, height: 36 },
});

const sectionStyles = StyleSheet.create({
  section: { paddingVertical: 64 },
  inner: {},
  eyebrow: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 },
  heading: { fontSize: 32, fontFamily: 'Poppins_700Bold', lineHeight: 42, marginBottom: 40 },
});

const featureStyles = StyleSheet.create({
  grid: { gap: 16 },
  gridTablet: { flexDirection: 'row', flexWrap: 'wrap' },
  gridDesktop: { flexDirection: 'row', flexWrap: 'wrap' },
  card: {
    borderRadius: 16, padding: 24, borderWidth: 1,
    flex: 1, minWidth: 260,
  },
  iconCircle: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: 'rgba(0,129,200,0.12)', alignItems: 'center',
    justifyContent: 'center', marginBottom: 16,
  },
  title: { fontSize: 17, fontFamily: 'Poppins_600SemiBold', marginBottom: 8 },
  desc: { fontSize: 14, fontFamily: 'Poppins_400Regular', lineHeight: 22 },
});

const cityStyles = StyleSheet.create({
  scroll: { gap: 12, paddingVertical: 4 },
  card: {
    width: 150, height: 90, borderRadius: 14,
    justifyContent: 'flex-end', padding: 14, gap: 2,
  },
  name: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: '#fff' },
});

const tierStyles = StyleSheet.create({
  grid: { gap: 16 },
  gridDesktop: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  card: {
    borderRadius: 20, padding: 28, borderWidth: 1.5, flex: 1, minWidth: 260,
  },
  cardHighlight: {
    borderWidth: 2,
  },
  badge: {
    alignSelf: 'flex-start', backgroundColor: '#0081C8',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 16,
  },
  badgeText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  tierName: { fontSize: 20, fontFamily: 'Poppins_700Bold', marginBottom: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 24 },
  price: { fontSize: 36, fontFamily: 'Poppins_700Bold' },
  period: { fontSize: 14, fontFamily: 'Poppins_400Regular' },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  featureText: { fontSize: 14, fontFamily: 'Poppins_400Regular', flex: 1 },
  cta: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  ctaText: { fontSize: 15, fontFamily: 'Poppins_700Bold', color: '#fff' },
});

const ctaStyles = StyleSheet.create({
  banner: { borderRadius: 20, padding: 40, alignItems: 'center', gap: 12 },
  bannerTitle: { fontSize: 28, fontFamily: 'Poppins_700Bold', color: '#fff', textAlign: 'center' },
  bannerSub: { fontSize: 16, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  bannerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 14, marginTop: 8,
  },
  bannerBtnText: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: '#0081C8' },
});

const footerStyles = StyleSheet.create({
  footer: { paddingTop: 48, paddingBottom: 32, borderTopWidth: 1 },
  inner: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40 },
  brand: { gap: 12, flex: 1 },
  tagline: { fontSize: 14, fontFamily: 'Poppins_400Regular' },
  cols: { flexDirection: 'row', gap: 60 },
  col: { gap: 12 },
  colHeading: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', marginBottom: 4 },
  colItem: { fontSize: 14, fontFamily: 'Poppins_400Regular' },
  copy: { fontSize: 13, fontFamily: 'Poppins_400Regular', textAlign: 'center', marginTop: 24 },
});
