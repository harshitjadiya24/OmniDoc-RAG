import { AskPipeline } from "@/components/landing/ask-pipeline";
import { DocTypes } from "@/components/landing/doc-types";
import { FactsStrip } from "@/components/landing/facts-strip";
import { FilmSection } from "@/components/landing/film-section";
import { Faq } from "@/components/landing/faq";
import { FinalCta } from "@/components/landing/final-cta";
import { Hero } from "@/components/landing/hero";
import { Ingestion } from "@/components/landing/ingestion";
import { Modes } from "@/components/landing/modes";
import { Privacy } from "@/components/landing/privacy";
import { Problems } from "@/components/landing/problems";
import { SmoothScroll } from "@/components/landing/smooth-scroll";
import { Verification } from "@/components/landing/verification";

export default function LandingPage() {
  return (
    <>
      <SmoothScroll />
      <Hero />
      <FilmSection />
      <FactsStrip />
      <Problems />
      <Ingestion />
      <AskPipeline />
      <Verification />
      <Modes />
      <DocTypes />
      <Privacy />
      <Faq />
      <FinalCta />
    </>
  );
}
