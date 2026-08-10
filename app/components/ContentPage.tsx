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
  heroImage,
  current,
}: ContentPageProps) {
  const hasHeroImage = Boolean(heroImage);

  return (
    <main>
      <section
        className={`subpage-hero content-hero ${
          hasHeroImage ? "content-hero--image" : "content-hero--brand"
        }`}
        data-page={current}
      >
        {hasHeroImage ? (
          <div className="subpage-hero-bg" aria-hidden="true">
            <img className="subpage-hero-cover" src={heroImage} alt="" />
            <img className="subpage-hero-focus" src={heroImage} alt="" />
          </div>
        ) : null}
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
