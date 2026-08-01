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
      <section className="subpage-hero content-hero">
        <div className="subpage-hero-bg" aria-hidden="true">
          <img src={heroImage} alt="" fetchPriority="high" decoding="async" />
        </div>
        <div className="page-width subpage-hero-inner">
          <p>{eyebrow}</p>
          <h1>{title}</h1>
          <span>{description}</span>
        </div>
      </section>
      {children}
    </main>
  );
}
