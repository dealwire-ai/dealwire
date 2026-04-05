import Image from "next/image";

const CLIENT_LOGOS = [
  {
    file: "hildreth.png",
    alt: "Hildreth Real Estate Advisors",
    height: "h-[38px]",
  },
  { file: "jke.svg", alt: "JK Equities", height: "h-[36px]" },
  {
    file: "dg-development.svg",
    alt: "DG Development Partners",
    height: "h-[28px]",
  },
  { file: "foxfield.svg", alt: "Foxfield", height: "h-[26px]" },
  {
    file: "rm.png",
    alt: "R&M Capital Property Management",
    height: "h-[44px]",
  },
];

export function ClientLogos() {
  return (
    <section className="relative z-10 px-6 lg:px-16 py-14 border-t border-white/[0.04]">
      <div className="max-w-7xl mx-auto">
        <p className="text-xs font-mono text-white/20 tracking-widest uppercase text-center mb-10">
          Trusted by top operators
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-14 gap-y-8">
          {CLIENT_LOGOS.map(({ file, alt, height }) => (
            <div
              key={file}
              className="opacity-25 hover:opacity-55 transition-opacity duration-300"
              style={{ filter: "brightness(0) invert(1)" }}
            >
              <Image
                src={`/logos/${file}`}
                alt={alt}
                width={140}
                height={40}
                className={`object-contain ${height} w-auto`}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
