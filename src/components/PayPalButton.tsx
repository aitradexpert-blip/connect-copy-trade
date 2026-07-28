interface PayPalButtonProps {
  hostedButtonId: string;
}

export function PayPalButton({ hostedButtonId }: PayPalButtonProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <form
        action={`https://www.paypal.com/ncp/payment/${hostedButtonId}`}
        method="post"
        target="_blank"
        className="flex flex-col items-center gap-2"
      >
        <input
          type="submit"
          value="Pay Now"
          style={{
            textAlign: 'center',
            border: 'none',
            borderRadius: '0.25rem',
            minWidth: '11.625rem',
            padding: '0 2rem',
            height: '2.625rem',
            fontWeight: 'bold',
            backgroundColor: '#FFD140',
            color: '#000000',
            fontFamily: '"Helvetica Neue", Arial, sans-serif',
            fontSize: '1rem',
            lineHeight: '1.25rem',
            cursor: 'pointer',
          }}
        />
        <img src="https://www.paypalobjects.com/images/Debit_Credit_APM.svg" alt="cards accepted" />
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          Powered by
          <img
            src="https://www.paypalobjects.com/paypal-ui/logos/svg/paypal-wordmark-color.svg"
            alt="PayPal"
            style={{ height: '0.875rem' }}
          />
        </span>
      </form>
    </div>
  );
}
