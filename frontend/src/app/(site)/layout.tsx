import { IntroFilm } from "@/components/film/intro-film";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import "lenis/dist/lenis.css";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <IntroFilm />
      <div data-site-chrome className="contents">
        <SiteHeader />
      </div>
      <main id="main" tabIndex={-1} data-site-chrome className="flex flex-1 flex-col focus:outline-none">
        {children}
      </main>
      <div data-site-chrome className="contents">
        <SiteFooter />
      </div>
    </>
  );
}
