import { Box } from "@mantine/core";
import TopNav from "../components/home/TopNav";
import HeroSection from "../components/home/HeroSection";
import FeaturesSection from "../components/home/FeaturesSection";
import HowItWorksSection from "../components/home/HowItWorksSection";
import PricingSection from "../components/home/PricingSection";
import Footer from "../components/home/Footer";
import classes from "./Home.module.css";

export default function Home() {
  return (
    <Box style={{ minHeight: "100vh", backgroundColor: "var(--mantine-color-body)" }}>
      <TopNav />
      <HeroSection />
      <div className={classes.divider} />
      <FeaturesSection />
      <div className={classes.divider} />
      <HowItWorksSection />
      <div className={classes.divider} />
      <PricingSection />
      <div className={classes.divider} />
      <Footer />
    </Box>
  );
}
