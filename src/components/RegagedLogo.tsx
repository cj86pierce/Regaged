import Image from "next/image";

export default function RegagedLogo() {
  return <Image src="/regaged-logo.png" alt="Regaged" width={176} height={60} priority unoptimized style={{ display: "block", maxWidth: "min(176px, 46vw)", height: "auto" }} />;
}
