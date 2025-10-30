import { AlertTriangle } from "lucide-react";

export default function FSCADisclaimer() {
  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border-l-4 border-amber-500 p-4 mb-6 rounded-r-lg">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed">
            <strong className="font-semibold">Important Disclosure:</strong> This is a technology platform only. 
            We do not provide financial advice. All trading carries risk of loss. 
            Trade at your own risk. Platform regulated by FSCA.
          </p>
        </div>
      </div>
    </div>
  );
}
