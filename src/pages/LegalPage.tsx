import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const LEGAL_CONTENT: Record<string, { title: string; body: string }> = {
  "privacy-policy": {
    title: "Privacy Policy",
    body: `HuMi Mobile is committed to protecting your personal information in accordance with the Protection of Personal Information Act 4 of 2013 (POPIA).

RESPONSIBLE PARTY
HuMi Mobile (Pty) Ltd — support@humi.co.za

INFORMATION WE COLLECT
Name, email address, trading account identifiers (login IDs, server names), usage data, and device information. We do NOT store MT4/MT5 passwords after the initial connection is established.

HOW WE USE YOUR INFORMATION
To provide platform services, execute trading instructions on your behalf, send service notifications, comply with legal obligations, and improve our platform.

DATA STORAGE & SECURITY
Your data is stored on Supabase infrastructure hosted in secure data centres. We use TLS encryption in transit and AES encryption at rest. We do not sell personal information to third parties.

YOUR RIGHTS UNDER POPIA
You have the right to: access your personal information, request correction, request deletion, object to processing, and lodge a complaint with the Information Regulator of South Africa (inforegulator.org.za).

DATA RETENTION
Account data is retained for the duration of your subscription plus 5 years as required by South African financial services regulations.

CONTACT
Information Officer: support@humi.co.za`,
  },
  "terms-of-service": {
    title: "Terms of Service",
    body: `HUMI MOBILE — TERMS OF SERVICE
Last updated: July 2026

1. PLATFORM NATURE
HuMi is a technology platform only. We do not provide financial advice, investment recommendations, or portfolio management services. All trading signals, copy trading features, and AI bot outputs are informational and educational in nature.

2. RISK ACKNOWLEDGEMENT
Trading financial instruments carries substantial risk of loss. You may lose some or all of your invested capital. Past results do not guarantee future performance. You trade entirely at your own risk.

3. ACCOUNT SECURITY
You are responsible for maintaining the security of your HuMi login credentials. HuMi has trade-only API access to connected broker accounts and cannot withdraw funds from any broker account.

4. SUBSCRIPTION & BILLING
Basic plan: 1 trading account, access to signals and copy trading features. Subscriptions are billed monthly. Fees are non-refundable once a billing period has commenced. You may cancel at any time; access continues until the end of the paid period.

5. ACCEPTABLE USE
You may not use HuMi to violate any applicable law or broker terms of service, engage in market manipulation, or attempt to access other users' accounts.

6. GOVERNING LAW
These terms are governed by the laws of the Republic of South Africa.

7. CONTACT
support@humi.co.za`,
  },
  "risk-disclosure": {
    title: "Risk Disclosure Statement",
    body: `IMPORTANT — PLEASE READ CAREFULLY

Trading forex, CFDs, commodities, indices, and other financial instruments involves substantial risk of loss and is not appropriate for all investors.

KEY RISKS:
- You may lose your entire invested capital
- Leverage amplifies both potential profits and potential losses significantly
- Past performance of any trading signal, mentor, or AI bot is not indicative of future results
- Copy trading results achieved by others may not be replicated in your account due to differences in account size, timing, broker execution, and market conditions
- Automated trading (AI bot) may malfunction, execute at unfavourable prices, or fail to execute under certain market conditions
- Cryptocurrency and exotic forex pairs may experience extreme volatility

HuMi does not guarantee trading profits under any circumstances. All trading ideas and signals are provided for informational and educational purposes only and do not constitute financial advice as defined under the Financial Advisory and Intermediary Services Act (FAIS) of South Africa.

You should only trade with money you can afford to lose. If you are uncertain about your risk tolerance, please seek independent financial advice from a licensed Financial Services Provider (FSP) registered with the Financial Sector Conduct Authority (FSCA).`,
  },
  "popia-notice": {
    title: "POPIA Information Notice",
    body: `PROTECTION OF PERSONAL INFORMATION ACT (POPIA) — ACT 4 OF 2013
Effective: 1 July 2021

RESPONSIBLE PARTY
HuMi Mobile (Pty) Ltd
Information Officer: support@humi.co.za

PURPOSE OF COLLECTION
We collect and process your personal information solely for the purpose of providing our trading technology platform, including account management, signal delivery, copy trading functionality, and subscription billing.

LAWFUL BASIS
Processing is based on: (a) your explicit consent provided at registration; (b) contractual necessity to provide services you have requested; (c) compliance with legal obligations under South African financial services regulation.

CATEGORIES OF DATA PROCESSED
Personal identifiers (name, email), trading account credentials (login IDs and server names only — not passwords after connection), usage and activity data, subscription and billing data, and device/session information.

CROSS-BORDER TRANSFERS
Your data may be processed by service providers located outside South Africa, including Supabase (USA) and Vercel (USA). Appropriate cross-border transfer safeguards as required by POPIA Section 72 are in place.

DATA RETENTION
Active account data: for the duration of your subscription.
Post-cancellation: 5 years as required by FICA and financial services regulations.

YOUR RIGHTS
Under POPIA you have the right to access, correct, delete, or object to processing of your personal information. Submit requests to support@humi.co.za. If unresolved within 30 days you may escalate to the Information Regulator of South Africa (inforegulator.org.za).`,
  },
  "cookie-policy": {
    title: "Cookie Policy",
    body: `HUMI MOBILE — COOKIE & TRACKING POLICY

WHAT WE USE
HuMi uses session tokens (stored in browser local storage, not cookies) to keep you logged in. These are essential and cannot be disabled.

We use anonymised, aggregated analytics to understand how users interact with the platform. No personally identifiable information is included in analytics data.

WHAT WE DO NOT USE
- Advertising or tracking cookies
- Third-party marketing pixels
- Social media tracking
- Fingerprinting technologies

YOUR CHOICES
Since we rely on session tokens rather than traditional cookies for core functionality, standard browser cookie controls do not affect platform access. To delete your session data, log out of HuMi.

For questions about our data practices, contact support@humi.co.za`,
  },
};

export default function LegalPage() {
  const { page } = useParams<{ page: string }>();
  const navigate = useNavigate();
  const content = page ? LEGAL_CONTENT[page] : undefined;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto space-y-4 py-8 px-4">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        {content ? (
          <>
            <h1 className="text-2xl font-bold text-foreground">{content.title}</h1>
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-sans leading-relaxed">
                  {content.body}
                </pre>
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground">Legal page not found.</p>
            <Button variant="link" onClick={() => navigate('/settings')}>Back to Settings</Button>
          </div>
        )}
      </div>
    </div>
  );
}
