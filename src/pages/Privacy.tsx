import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Privacy() {
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="text-2xl">Privacy Policy (POPIA)</CardTitle>
            <p className="text-sm text-muted-foreground">Effective date: 8 June 2026 · Version 2026-06-08</p>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-4 text-sm leading-relaxed text-foreground">
            <p>
              This Privacy Policy explains how HuMi collects, uses and protects your personal information
              in compliance with the Protection of Personal Information Act, 2013 (POPIA) of the Republic
              of South Africa.
            </p>

            <h3 className="text-lg font-semibold">1. Responsible party</h3>
            <p>
              HuMi is the responsible party (data controller) for the personal information you submit
              through the app. You can contact us on Telegram at <a className="text-primary hover:underline" href="https://t.me/mansamusafx" target="_blank" rel="noopener noreferrer">@mansamusafx</a> for any privacy queries or to lodge a complaint.
            </p>

            <h3 className="text-lg font-semibold">2. Information we collect</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Account details: name, email, password hash, display name.</li>
              <li>Trading data: connected broker accounts, signals, executed trades, P&amp;L.</li>
              <li>Payment data: EFT proof of payment screenshots and reference, plan tier.</li>
              <li>KYC data: identity documents you choose to upload.</li>
              <li>Technical data: device type, IP address, app usage logs, push tokens.</li>
            </ul>

            <h3 className="text-lg font-semibold">3. Why we process it</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>To create and secure your account.</li>
              <li>To execute copy trades and AI bot trades on your connected broker accounts.</li>
              <li>To verify payments and activate subscriptions.</li>
              <li>To meet legal, regulatory and accounting obligations.</li>
              <li>To send service notifications (trade execution, payment status, announcements).</li>
            </ul>

            <h3 className="text-lg font-semibold">4. Lawful basis</h3>
            <p>
              We rely on your explicit consent (recorded each time you tick the POPIA consent box),
              performance of our contract with you, and our legitimate interest in operating and
              securing the platform.
            </p>

            <h3 className="text-lg font-semibold">5. Sharing</h3>
            <p>
              We share your data only with the third parties needed to deliver the service: broker APIs
              you connect, our hosting and database provider (Supabase), Telegram (for support
              forwarding) and analytics tools. We never sell your personal information.
            </p>

            <h3 className="text-lg font-semibold">6. International transfers</h3>
            <p>
              Some of our processors host data outside South Africa. Where this happens we ensure the
              receiving country offers an adequate level of protection or relies on contractual
              safeguards equivalent to POPIA.
            </p>

            <h3 className="text-lg font-semibold">7. Retention</h3>
            <p>
              We retain account data for as long as your account is active and for up to five years
              afterwards to satisfy legal and tax obligations. You can request earlier deletion (see
              your rights below).
            </p>

            <h3 className="text-lg font-semibold">8. Your rights under POPIA</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Access the personal information we hold about you.</li>
              <li>Request correction or deletion.</li>
              <li>Object to processing or withdraw your consent.</li>
              <li>Lodge a complaint with the Information Regulator (South Africa).</li>
            </ul>
            <p>
              To exercise any right, contact us on Telegram. We will respond within a reasonable time
              and no later than required by POPIA.
            </p>

            <h3 className="text-lg font-semibold">9. Security</h3>
            <p>
              We protect your data with TLS in transit, encryption at rest, row-level security on our
              database, and least-privilege access for staff. No system is perfectly secure; please use
              a strong unique password and notify us immediately if you suspect unauthorised access.
            </p>

            <h3 className="text-lg font-semibold">10. Children</h3>
            <p>
              HuMi is not intended for users under the age of 18 and we do not knowingly collect
              information from minors.
            </p>

            <h3 className="text-lg font-semibold">11. Changes</h3>
            <p>
              We may update this Policy. Material changes will be surfaced in the app and we will ask
              you to re-accept where required.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
