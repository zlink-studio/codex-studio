import { promises as fs } from "fs";
import path from "path";
import type { Project } from "@/lib/types";
import { getOutputsRoot } from "@/lib/storage-paths";

type CompanyProfile = {
  companyName: string;
  brandName: string;
  industry: string;
  targetMarkets: string[];
  websiteLanguage: string;
  coreAdvantages: string[];
  companyIntro: string;
  email: string;
  whatsapp: string;
  primaryColor: string;
};

type ProductSeed = {
  name: string;
  category: string;
  material: string;
  application: string;
  customization: string;
  shortDescription: string;
  features: string[];
};

type PageDraft = {
  slug: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  sections: Array<{
    heading: string;
    body: string;
    bullets?: string[];
  }>;
};

type SiteDraft = {
  projectId: string;
  generatedAt: string;
  structure: {
    navigation: string[];
    pages: string[];
  };
  companyProfile: CompanyProfile;
  products: ProductSeed[];
  pages: PageDraft[];
  seo: Record<string, { title: string; description: string }>;
  files: string[];
  outputDir: string;
};

const outputRoot = getOutputsRoot();

export async function generateSiteDraft(project: Project): Promise<SiteDraft> {
  const generatedAt = new Date().toISOString();
  const companyProfile = buildCompanyProfile(project);
  const products = buildProducts();
  const pages = buildPages(companyProfile, products);
  const structure = {
    navigation: ["Home", "About Us", "Products", "Services", "FAQ", "Contact Us"],
    pages: pages.map((page) => page.slug)
  };
  const seo = Object.fromEntries(
    pages.map((page) => [page.slug, { title: page.seoTitle, description: page.seoDescription }])
  );

  const outputDir = path.join(outputRoot, project.id);
  await fs.mkdir(outputDir, { recursive: true });

  const files: string[] = [];
  await writeJson(outputDir, "project.json", { project, companyProfile, generatedAt }, files);
  await writeJson(outputDir, "site-structure.json", structure, files);
  await writeJson(outputDir, "products.json", products, files);
  await writeJson(outputDir, "pages.json", pages, files);
  await writeJson(outputDir, "seo.json", seo, files);
  await writeJson(
    outputDir,
    "wordpress-publish-log.json",
    {
      status: "draft_ready",
      connected: false,
      message: "Draft package generated locally. Configure WordPress credentials before publish.",
      generatedAt
    },
    files
  );

  for (const page of pages) {
    const html = renderHtmlPage(companyProfile, page);
    await fs.writeFile(path.join(outputDir, `${page.slug}.html`), html, "utf8");
    files.push(`${page.slug}.html`);
  }

  return {
    projectId: project.id,
    generatedAt,
    structure,
    companyProfile,
    products,
    pages,
    seo,
    files,
    outputDir
  };
}

export async function readSiteDraftStatus(projectId: string) {
  const outputDir = path.join(outputRoot, projectId);

  try {
    const stat = await fs.stat(outputDir);
    if (!stat.isDirectory()) return null;
  } catch {
    return null;
  }

  const entries = await fs.readdir(outputDir);
  const seoPath = path.join(outputDir, "seo.json");
  let generatedAt: string | null = null;

  try {
    const raw = JSON.parse(await fs.readFile(seoPath, "utf8")) as Record<string, unknown>;
    generatedAt = raw ? (await fs.stat(seoPath)).mtime.toISOString() : null;
  } catch {
    generatedAt = null;
  }

  return {
    exists: true,
    outputDir,
    generatedAt,
    files: entries.sort()
  };
}

async function writeJson(outputDir: string, fileName: string, data: unknown, files: string[]) {
  await fs.writeFile(path.join(outputDir, fileName), JSON.stringify(data, null, 2), "utf8");
  files.push(fileName);
}

function buildCompanyProfile(project: Project): CompanyProfile {
  return {
    companyName: "Hanhai Mining",
    brandName: "Hanhai Mining",
    industry: "Mining Machinery Parts",
    targetMarkets: ["Africa", "Central Asia", "South America"],
    websiteLanguage: "English",
    coreAdvantages: [
      "Factory Direct Supply",
      "OEM Customization",
      "Stable Delivery",
      "Export Project Support",
      "Quality Inspection"
    ],
    companyIntro:
      "Hanhai Mining supplies heavy-duty cast steel parts and industrial transmission components for mining, cement and bulk material handling projects.",
    email: "sales@hanhaimining.com",
    whatsapp: "+86 138 0000 0000",
    primaryColor: "#1d4f91"
  };
}

function buildProducts(): ProductSeed[] {
  return [
    {
      name: "Ring Gear",
      category: "Mining Machinery Parts",
      material: "Cast Steel",
      application: "Ball Mill, Rotary Kiln",
      customization: "Yes",
      shortDescription:
        "Heavy-duty ring gears for large industrial transmission systems with stable performance in continuous operation.",
      features: ["Customized size and module", "Precision machining", "Suitable for bulk orders", "Project-based export support"]
    },
    {
      name: "Gear Shaft",
      category: "Mining Machinery Parts",
      material: "Forged Steel",
      application: "Crusher, Mill Drive",
      customization: "Yes",
      shortDescription:
        "Gear shafts designed for industrial load-bearing scenarios with machining accuracy and material traceability.",
      features: ["Forged steel option", "Flexible machining", "Long service life focus", "Inspection before shipment"]
    },
    {
      name: "Slag Pot",
      category: "Steel Plant Equipment",
      material: "Heat-resistant Cast Steel",
      application: "Steel Mill Handling",
      customization: "Yes",
      shortDescription:
        "Heat-resistant slag pots for steel and foundry projects with custom size support and export packaging.",
      features: ["Heat-resistant material", "Custom dimensions", "Heavy load handling", "Factory direct supply"]
    }
  ];
}

function buildPages(company: CompanyProfile, products: ProductSeed[]): PageDraft[] {
  const productNames = products.map((item) => item.name).join(", ");

  return [
    {
      slug: "home",
      title: "Home",
      seoTitle: "Mining Machinery Parts Supplier | Hanhai Mining",
      seoDescription:
        "Factory direct supply of ring gears, gear shafts and customized mining machinery parts for export-oriented industrial projects.",
      sections: [
        {
          heading: "Heavy-Duty Mining Machinery Parts for Global Projects",
          body:
            "Factory direct supply of ring gears, gear shafts, slag pots and customized cast steel parts for mining, cement and industrial equipment."
        },
        {
          heading: "What We Supply",
          body: `Our core products include ${productNames}. We focus on clear specifications, stable delivery and practical support for procurement teams.`,
          bullets: products.map((item) => `${item.name}: ${item.shortDescription}`)
        },
        {
          heading: "Why Buyers Work With Us",
          body: "The first version of the site highlights practical B2B trust signals instead of exaggerated claims.",
          bullets: company.coreAdvantages
        }
      ]
    },
    {
      slug: "about",
      title: "About Us",
      seoTitle: "About Hanhai Mining | Export Supply Support",
      seoDescription:
        "Learn how Hanhai Mining supports industrial buyers with factory supply, OEM customization and export coordination.",
      sections: [
        {
          heading: "Company Overview",
          body: company.companyIntro
        },
        {
          heading: "Who We Serve",
          body:
            "We support procurement managers, distributors and project buyers looking for stable industrial supply from China.",
          bullets: company.targetMarkets
        },
        {
          heading: "How We Work",
          body:
            "We confirm requirements, review technical scope, prepare a quotation, manage production or sourcing, inspect before shipment and support export coordination."
        }
      ]
    },
    {
      slug: "products",
      title: "Products",
      seoTitle: "Mining Machinery Parts Products | Hanhai Mining",
      seoDescription:
        "Browse product categories including ring gears, gear shafts and cast steel components for mining and cement projects.",
      sections: [
        {
          heading: "Product Categories",
          body: "The MVP output uses a clear category-first structure to help buyers quickly find relevant products.",
          bullets: products.map((item) => `${item.name} / ${item.category}`)
        },
        {
          heading: "Selection Support",
          body:
            "If exact parameters are not ready, we prepare a flexible parameter structure and mark customizable fields instead of inventing data."
        }
      ]
    },
    {
      slug: "services",
      title: "Services",
      seoTitle: "Project Support Services | Hanhai Mining",
      seoDescription:
        "Project support for requirement review, quotation, production coordination, inspection and export shipment.",
      sections: [
        {
          heading: "Project Support",
          body:
            "We help buyers move from requirement confirmation to shipment with a process designed for practical industrial cooperation."
        },
        {
          heading: "Service Flow",
          body: "A simple seven-step export support flow is included in the draft.",
          bullets: [
            "Requirement Confirmation",
            "Technical Review",
            "Quotation",
            "Production or Sourcing",
            "Quality Inspection",
            "Packaging and Shipment",
            "After-sales Communication"
          ]
        }
      ]
    },
    {
      slug: "faq",
      title: "FAQ",
      seoTitle: "FAQ for Mining Machinery Parts Buyers | Hanhai Mining",
      seoDescription:
        "Common questions about OEM customization, MOQ, lead time, inspection and export shipment for industrial orders.",
      sections: [
        {
          heading: "Frequently Asked Questions",
          body: "The draft FAQ focuses on procurement concerns instead of generic marketing language.",
          bullets: [
            "Can you support OEM customization? Yes, according to project requirements.",
            "Do you support bulk orders? Yes, for stable and repeated procurement needs.",
            "Can you arrange export shipment? Yes, including packaging and shipping coordination.",
            "How do you handle missing parameters? We mark them as customizable instead of inventing exact values."
          ]
        }
      ]
    },
    {
      slug: "contact",
      title: "Contact Us",
      seoTitle: "Contact Hanhai Mining | Send Inquiry",
      seoDescription:
        "Contact Hanhai Mining for product inquiries, OEM requests and export project discussions.",
      sections: [
        {
          heading: "Contact Our Team",
          body:
            "This MVP keeps the inquiry path short and clear, with direct contact details and a simple send inquiry CTA."
        },
        {
          heading: "Contact Details",
          body: `Email: ${company.email} | WhatsApp: ${company.whatsapp}`
        }
      ]
    }
  ];
}

function renderHtmlPage(company: CompanyProfile, page: PageDraft) {
  const sectionHtml = page.sections
    .map(
      (section) => `
      <section class="hh-ai-section">
        <h2>${section.heading}</h2>
        <p>${section.body}</p>
        ${
          section.bullets?.length
            ? `<ul>${section.bullets.map((item) => `<li>${item}</li>`).join("")}</ul>`
            : ""
        }
      </section>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${page.seoTitle}</title>
  <meta name="description" content="${page.seoDescription}" />
  <style>
    :root {
      --hh-ai-primary: ${company.primaryColor};
      --hh-ai-text: #162033;
      --hh-ai-muted: #5f6b7a;
      --hh-ai-bg: #f4f7fb;
      --hh-ai-card: #ffffff;
      --hh-ai-line: #d9e2ef;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: var(--hh-ai-bg);
      color: var(--hh-ai-text);
      line-height: 1.6;
    }
    .hh-ai-shell {
      max-width: 1120px;
      margin: 0 auto;
      padding: 32px 20px 56px;
    }
    .hh-ai-hero,
    .hh-ai-section {
      background: var(--hh-ai-card);
      border: 1px solid var(--hh-ai-line);
      border-radius: 20px;
      padding: 28px;
      margin-bottom: 20px;
    }
    .hh-ai-eyebrow {
      display: inline-block;
      color: var(--hh-ai-primary);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    h1, h2 { margin: 0 0 12px; }
    p { margin: 0 0 12px; color: var(--hh-ai-muted); }
    ul { margin: 12px 0 0; padding-left: 18px; color: var(--hh-ai-muted); }
    .hh-ai-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 18px;
    }
    .hh-ai-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 42px;
      padding: 0 18px;
      border-radius: 999px;
      text-decoration: none;
      font-weight: 700;
    }
    .hh-ai-btn-primary {
      background: var(--hh-ai-primary);
      color: #fff;
    }
    .hh-ai-btn-secondary {
      border: 1px solid var(--hh-ai-line);
      color: var(--hh-ai-text);
      background: #fff;
    }
    @media (max-width: 720px) {
      .hh-ai-shell { padding: 20px 14px 40px; }
      .hh-ai-hero, .hh-ai-section { padding: 20px; border-radius: 16px; }
    }
  </style>
</head>
<body>
  <main class="hh-ai-shell">
    <section class="hh-ai-hero">
      <span class="hh-ai-eyebrow">${company.industry}</span>
      <h1>${page.sections[0]?.heading ?? page.title}</h1>
      <p>${page.sections[0]?.body ?? company.companyIntro}</p>
      <div class="hh-ai-actions">
        <a class="hh-ai-btn hh-ai-btn-primary" href="/contact">Send Inquiry</a>
        <a class="hh-ai-btn hh-ai-btn-secondary" href="/products">View Products</a>
      </div>
    </section>
    ${sectionHtml}
  </main>
</body>
</html>`;
}
