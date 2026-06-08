import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";

interface PopiaConsentCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  className?: string;
}

/**
 * Mandatory POPIA-compliant consent checkbox.
 * Use anywhere a user takes an action that needs explicit T&Cs / privacy acceptance:
 * signup, copy trading activation, AI bot activation, trade idea execution, payment.
 */
export default function PopiaConsentCheckbox({
  checked,
  onChange,
  id = "popia-consent",
  className = "",
}: PopiaConsentCheckboxProps) {
  return (
    <div className={`flex items-start gap-2 text-sm ${className}`}>
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5"
      />
      <label htmlFor={id} className="text-muted-foreground leading-snug cursor-pointer">
        I agree to the{" "}
        <Link to="/terms" target="_blank" className="text-primary hover:underline">
          Terms &amp; Conditions
        </Link>{" "}
        and{" "}
        <Link to="/privacy" target="_blank" className="text-primary hover:underline">
          Privacy Policy
        </Link>{" "}
        in compliance with the POPIA Act.
      </label>
    </div>
  );
}

/** Helper: record a user's consent in `user_consents`. */
export async function recordConsent(
  supabase: any,
  userId: string,
  consentType: 'signup' | 'copy_trading' | 'ai_bot' | 'trade_idea' | 'payment',
  metadata: Record<string, any> = {}
) {
  try {
    await supabase.from('user_consents').insert({
      user_id: userId,
      consent_type: consentType,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      metadata,
    });
  } catch (err) {
    console.error('[recordConsent] Failed:', err);
  }
}
