import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Terms() {
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="text-2xl">Terms &amp; Conditions</CardTitle>
            <p className="text-sm text-muted-foreground">Effective date: 8 June 2026 · Version 2026-06-08</p>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-4 text-sm leading-relaxed text-foreground">
            <h3 className="text-lg font-semibold">1. About HuMi</h3>
            <p>
              HuMi (&quot;we&quot;, &quot;us&quot;) is a South-African technology platform that connects retail traders
              with third-party brokers, mentors and tools. We act strictly as a mediator and technology
              provider. We are not a registered financial services provider and we do not provide
              financial, investment or tax advice.
            </p>

            <h3 className="text-lg font-semibold">2. Acceptance</h3>
            <p>
              By creating an account, activating copy trading or the AI bot, executing a trade idea or
              submitting a payment, you confirm that you have read, understood and accepted these Terms
              and the Privacy Policy.
            </p>

            <h3 className="text-lg font-semibold">3. Eligibility</h3>
            <p>
              You must be at least 18 years old and legally able to enter into binding contracts in your
              jurisdiction. You are responsible for ensuring that using HuMi is lawful where you live.
            </p>

            <h3 className="text-lg font-semibold">4. Trading risk</h3>
            <p>
              Trading leveraged products carries a high level of risk and may not be suitable for everyone.
              You can lose more than your initial deposit. Past performance shown on HuMi (mentor records,
              AI bot history, copy-trading statistics) is never a guarantee of future results. You make
              your own trading decisions and are solely responsible for the outcome.
            </p>

            <h3 className="text-lg font-semibold">5. Mentors and copy trading</h3>
            <p>
              Mentors on HuMi are independent third parties. When you follow a mentor or activate copy
              trading, you authorise HuMi to mirror that mentor&apos;s trade signals to your connected
              broker account using the parameters you select (lot size, risk limit, instruments). HuMi
              does not guarantee execution speed or accuracy and is not liable for broker-side rejections,
              slippage or downtime.
            </p>

            <h3 className="text-lg font-semibold">6. AI bot</h3>
            <p>
              The AI bot executes trades on your behalf using your subscribed mentor&apos;s signals or rule
              sets. You can stop the bot at any time from the AI Auto Trading screen. You remain
              responsible for monitoring open positions and maintaining sufficient margin.
            </p>

            <h3 className="text-lg font-semibold">7. Payments &amp; subscriptions</h3>
            <p>
              Subscriptions are payable in advance via EFT into the HuMi bank account shown on the
              Subscription page. Access is activated after we receive and verify proof of payment.
              Refunds are at our discretion and limited to amounts paid for unused full months where the
              service was demonstrably unavailable.
            </p>

            <h3 className="text-lg font-semibold">8. Acceptable use</h3>
            <p>
              You may not use HuMi to launder funds, to abuse our brokers&apos; promotional terms, to
              reverse-engineer the platform or to harass other users. We may suspend access for any breach.
            </p>

            <h3 className="text-lg font-semibold">9. Limitation of liability</h3>
            <p>
              To the maximum extent permitted by South African law, HuMi&apos;s aggregate liability to you
              is limited to the subscription fees you paid in the three months preceding the event giving
              rise to the claim. We are not liable for indirect, consequential or trading-loss damages.
            </p>

            <h3 className="text-lg font-semibold">10. Changes</h3>
            <p>
              We may update these Terms from time to time. We will surface material changes inside the
              app and ask you to re-accept where required.
            </p>

            <h3 className="text-lg font-semibold">11. Governing law &amp; disputes</h3>
            <p>
              These Terms are governed by the laws of the Republic of South Africa. Any dispute will be
              referred first to good-faith negotiation and then to the South African courts.
            </p>

            <h3 className="text-lg font-semibold">12. Contact</h3>
            <p>
              Reach us on Telegram at <a className="text-primary hover:underline" href="https://t.me/+dFAS3vs7awAwOWJk" target="_blank" rel="noopener noreferrer">our community channel</a> or via <a className="text-primary hover:underline" href="https://t.me/mansamusafx" target="_blank" rel="noopener noreferrer">@mansamusafx</a>.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
