import { requireAdmin } from "@/lib/auth/admin";
import { getTagsWithUsage } from "@/lib/data/admin/tags";
import { PageHeader } from "@/components/admin/page-header";
import { TagCreateForm } from "./tag-create-form";
import { TagRow } from "./tag-row";

export const metadata = { title: "Tags · mktbd admin" };

export default async function AdminTagsPage() {
  await requireAdmin();
  const tags = await getTagsWithUsage();

  return (
    <>
      <PageHeader
        title="Tags"
        description="One shared tag list for Analysis and Case Studies. Names that differ only by capitalisation or spacing count as the same tag."
      />

      <section aria-labelledby="new-tag-heading" className="mt-6">
        <h2 id="new-tag-heading" className="sr-only">
          New tag
        </h2>
        <TagCreateForm />
      </section>

      <section aria-labelledby="all-tags-heading" className="mt-8">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 id="all-tags-heading" className="text-sm font-semibold">
            All tags
          </h2>
          <p className="text-xs text-muted">
            {tags.length} {tags.length === 1 ? "tag" : "tags"}
          </p>
        </div>

        {tags.length === 0 ? (
          <div className="border border-dashed border-light-grey bg-white px-5 py-10 text-center">
            <p className="text-sm font-medium">No tags yet</p>
            <p className="mt-1 text-sm text-muted">
              Create the first tag above. Tags can then be attached to
              Analysis and Case Studies.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-light-grey bg-white">
            <table className="w-full border-collapse text-sm sm:min-w-[40rem]">
              <caption className="sr-only">
                Tags with the number of Analysis and Case Study entries using each
              </caption>
              <thead>
                <tr className="border-b border-light-grey text-left text-xs font-medium uppercase tracking-wide text-muted">
                  <th scope="col" className="px-4 py-2.5">Name</th>
                  <th scope="col" className="hidden w-24 px-4 py-2.5 text-right sm:table-cell">Analysis</th>
                  <th scope="col" className="hidden w-28 px-4 py-2.5 text-right sm:table-cell">Case Studies</th>
                  <th scope="col" className="w-16 px-4 py-2.5 text-right sm:w-20">Total</th>
                  <th scope="col" className="px-4 py-2.5 text-right sm:w-48">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tags.map((tag) => (
                  <TagRow key={tag.id} tag={tag} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
