import Script from "next/script";

const RB2B_KEY = "5NRP9H7LPXO1";

export function RB2BScript() {
  if (process.env.NODE_ENV !== "production") return null;

  return (
    <Script id="rb2b" strategy="lazyOnload">
      {`!function(key){if(window.reb2b)return;window.reb2b={loaded:true};var s=document.createElement("script");s.async=true;s.src="https://ddwl4m2hdecbv.cloudfront.net/b/"+key+"/"+key+".js.gz";document.getElementsByTagName("script")[0].parentNode.insertBefore(s,document.getElementsByTagName("script")[0]);}("${RB2B_KEY}");`}
    </Script>
  );
}
