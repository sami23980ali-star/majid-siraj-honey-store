import { StoreShell } from "@/components/StoreShell";
import { knowledgeArticles } from "@/lib/knowledge";
import { ArrowRight, BookOpen } from "lucide-react";
import { Link, useRoute } from "wouter";

export default function KnowledgeArticle() {
  const [, params] = useRoute("/knowledge/:slug");
  const article = knowledgeArticles.find(item => item.slug === params?.slug);
  if (!article) return <StoreShell><main className="container py-24 text-center"><BookOpen className="mx-auto text-[#a45c08]" size={34} /><h1 className="mt-4 font-display text-4xl text-[#5e3508]">المقال غير متاح</h1><Link href="/knowledge" className="mt-5 inline-block rounded-xl bg-[#5e3508] px-5 py-3 text-sm font-bold text-[#f6cd70]">العودة إلى مركز المعرفة</Link></main></StoreShell>;
  return <StoreShell><main className="container max-w-4xl py-10 sm:py-16"><Link href="/knowledge" className="inline-flex items-center gap-1 text-xs font-bold text-[#a45c08]"><ArrowRight size={15} />مركز المعرفة</Link><article className="mt-6 rounded-[2rem] border border-[#ead8b3] bg-white p-6 shadow-[0_14px_35px_rgba(86,50,9,.07)] sm:p-10"><p className="text-xs font-bold text-[#a45c08]">{article.eyebrow} · {article.readingTime}</p><h1 className="mt-3 font-display text-5xl leading-tight text-[#5e3508]">{article.title}</h1><p className="mt-5 border-b border-[#f0e2c7] pb-6 text-sm leading-8 text-[#765a35]">{article.summary}</p><div className="mt-8 space-y-9">{article.sections.map(section => <section key={section.heading}><h2 className="font-display text-3xl text-[#5e3508]">{section.heading}</h2>{section.paragraphs.map(paragraph => <p key={paragraph} className="mt-3 text-sm leading-8 text-[#765a35]">{paragraph}</p>)}</section>)}</div><aside className="mt-9 rounded-2xl bg-[#f9edda] p-5 text-xs leading-7 text-[#6c4a1d]">هذا المحتوى للتثقيف العام حول المنتجات وطرق الاستخدام والحفظ، ولا يُعد نصيحة طبية أو علاجية.</aside></article></main></StoreShell>;
}
