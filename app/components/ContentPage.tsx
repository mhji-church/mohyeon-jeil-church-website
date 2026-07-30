import { SiteFooter, SiteHeader } from "./SiteChrome";

type ContentPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  heroImage?: string;
  current: string;
};

export default function ContentPage({
  eyebrow,
  title,
  description,
  children,
  heroImage = "/assets/hero-flowers.webp",
}: ContentPageProps) {
  return (
    <main>
      <SiteHeader />
      <section className="subpage-hero content-hero">
        <div className="subpage-hero-bg" aria-hidden="true">
          <img src={heroImage} alt="" />
        </div>
        <div className="page-width subpage-hero-inner">
          <p>{eyebrow}</p>
          <h1>{title}</h1>
          <span>{description}</span>
        </div>
      </section>
      {children}
      <SiteFooter />
    </main>
  );
}
