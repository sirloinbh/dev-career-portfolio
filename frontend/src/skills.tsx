import { Pencil, Plus, Trash2, Wrench } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { Button } from './components/ui/button';
import { ConfirmDialog } from './components/ui/confirm-dialog';
import { EmptyState } from './components/ui/empty-state';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Notice } from './components/ui/notice';
import { SkeletonList } from './components/ui/skeleton';
import { toast } from './components/ui/sonner';
import { deleteItem } from './delete-item';
import { entryCount } from './entry-count';
import { controlClass } from './form-fields';
import { useServerForm } from './form-state';
import { errorText } from './lib/use-notice';
import { cn } from './lib/utils';
import { BackLink, PageHeader } from './page-header';
import {
  emptySkillForm,
  groupSkills,
  maxProficiency,
  proficiencyLevels,
  proficiencyName,
  proficiencyText,
  type Skill,
  skillApi,
  skillCategories,
  skillCategoryLabels,
  skillFieldErrors,
  type SkillForm,
  type SkillPaths,
  toSkillForm,
  toSkillInput,
} from './skill-data';
import { TextBlocks } from './text-blocks';
import { useLoad, useReloading } from './use-load';

const loadSkills = () => skillApi.list();

/**
 * Five dots, the first `value` filled, then "4/5 · Advanced". The dots and the short text are hidden
 * from screen readers, which read the full sentence instead ("Proficiency 4 of 5, Advanced").
 */
function Proficiency({ value }: { value: number }) {
  const name = proficiencyName(value);
  return (
    <p className="flex items-center gap-2 text-body-sm text-muted-foreground">
      <span aria-hidden className="flex gap-1">
        {Array.from({ length: maxProficiency }, (_, index) => (
          <span
            key={index}
            className={cn(
              // 60% keeps an empty dot's outline at 3:1 or more on the white card, not only the dark one.
              'size-2.5 rounded-full border border-foreground/60',
              index < value ? 'bg-foreground' : 'bg-transparent',
            )}
          />
        ))}
      </span>
      <span aria-hidden>
        {value}/{maxProficiency}
        {name ? ` · ${name}` : ''}
      </span>
      <span className="sr-only">{proficiencyText(value)}</span>
    </p>
  );
}

function SkillItem({
  skill,
  paths,
  onDelete,
}: {
  skill: Skill;
  paths: SkillPaths;
  onDelete: (skill: Skill) => Promise<void>;
}) {
  const titleId = `skill-${skill.id}`;
  return (
    <li aria-labelledby={titleId} className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        {/* break-keep keeps Korean words whole; wrap-anywhere still breaks a long unspaced name at 390px. */}
        <h3 id={titleId} className="text-body font-semibold wrap-anywhere break-keep">
          {skill.name}
        </h3>
        <Proficiency value={skill.proficiency} />
      </div>
      <TextBlocks entries={[['Notes', skill.memo]]} />
      <div className="flex flex-wrap gap-2 pt-1">
        <Button asChild variant="outline" size="sm">
          <Link to={paths.edit(skill.id)} aria-label={`Edit ${skill.name}`}>
            <Pencil aria-hidden />
            Edit
          </Link>
        </Button>
        <ConfirmDialog
          title="Delete this skill?"
          description={
            <span className="wrap-anywhere break-keep">
              &apos;{skill.name}&apos; will be deleted. This cannot be undone.
            </span>
          }
          onConfirm={() => onDelete(skill)}
          trigger={
            <Button variant="outline" size="sm" aria-label={`Delete ${skill.name}`}>
              <Trash2 aria-hidden />
              Delete
            </Button>
          }
        />
      </div>
    </li>
  );
}

export function SkillList({ paths }: { paths: SkillPaths }) {
  const { loaded, data, reload } = useReloading('all', loadSkills);
  const skills = data?.skills ?? [];
  const heading = useRef<HTMLHeadingElement>(null);
  // Only the first load shows the placeholder; a reload keeps the rows on screen.
  const firstLoad = loaded.state === 'loading' && data === undefined;

  const remove = async (skill: Skill) => {
    await deleteItem({ remove: () => skillApi.remove(skill.id), noun: 'skill', name: skill.name });
    reload((current) => ({ skills: current.skills.filter((item) => item.id !== skill.id) }));
    // The row and its delete button are gone, so focus would fall to the page body.
    requestAnimationFrame(() => heading.current?.focus());
  };

  return (
    <section aria-labelledby="page-title" aria-busy={firstLoad} className="flex flex-col gap-6">
      <PageHeader
        title="Skills"
        description="See the technologies you can work with, by category."
        headingRef={heading}
      >
        {/* Always mounted, so screen readers hear the text change from loading to the count. */}
        <p role="status" className="sr-only">
          {firstLoad ? 'Loading skills' : ''}
          {data ? entryCount(skills.length) : ''}
        </p>
      </PageHeader>
      <Button asChild className="w-fit">
        <Link to={paths.create}>
          <Plus aria-hidden />
          Add skill
        </Link>
      </Button>
      {firstLoad ? <SkeletonList rows={3} /> : null}
      {loaded.state === 'error' && data === undefined ? (
        // Say what failed first: a proxy error without a server message only carries the generic text.
        <Notice
          notice={{ kind: 'error', text: `Could not load skills. ${errorText(loaded.error)}` }}
        />
      ) : null}
      {data && skills.length === 0 ? (
        <EmptyState
          className="break-keep"
          icon={<Wrench />}
          title="No skills added yet"
          description="Add a skill and it will appear here by category, strongest first."
        />
      ) : null}
      {groupSkills(skills).map((group) => (
        // A plain group, not a landmark: six category regions would crowd the landmark list, and
        // the heading already lets a screen reader jump between categories.
        <div key={group.category} className="flex flex-col gap-3">
          <h2 className="flex items-baseline gap-2">
            {skillCategoryLabels[group.category]}{' '}
            <span className="text-body-sm font-normal text-muted-foreground">
              {entryCount(group.skills.length)}
            </span>
          </h2>
          {/* Unnamed: the heading just above names it, and the list itself says how many items. */}
          <ul className="flex flex-col divide-y rounded-xl border bg-card text-card-foreground shadow-sm">
            {group.skills.map((skill) => (
              <SkillItem key={skill.id} skill={skill} paths={paths} onDelete={remove} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function SkillFields({
  initial,
  submitLabel,
  cancelTo,
  onSubmit,
}: {
  initial: SkillForm;
  submitLabel: string;
  cancelTo: string;
  onSubmit: (form: SkillForm) => Promise<unknown>;
}) {
  const [form, setForm] = useState(initial);
  const { fieldId, describe, errorFor, submit, actions, pending } = useServerForm(skillFieldErrors);
  const set = (field: keyof SkillForm) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }));
  const proficiency = describe('proficiency', `${fieldId('proficiency')}-hint`);
  const invalid = proficiency['aria-invalid'] === true;

  return (
    // The server checks every rule and answers in English, so the browser's own checks are off.
    <form
      noValidate
      onSubmit={submit(() => onSubmit(form))}
      className="flex max-w-2xl flex-col gap-5"
      aria-busy={pending || undefined}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={fieldId('name')}>Skill name</Label>
        <Input
          id={fieldId('name')}
          maxLength={50}
          autoComplete="off"
          value={form.name}
          onChange={(e) => set('name')(e.target.value)}
          placeholder="e.g. TypeScript"
          {...describe('name')}
        />
        {errorFor('name')}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={fieldId('category')}>Category</Label>
        <select
          id={fieldId('category')}
          className={cn(controlClass, 'h-9 sm:max-w-xs')}
          value={form.category}
          onChange={(e) => set('category')(e.target.value)}
          {...describe('category')}
        >
          {skillCategories.map((value) => (
            <option key={value} value={value}>
              {skillCategoryLabels[value]}
            </option>
          ))}
        </select>
        {errorFor('category')}
      </div>
      {/* Native radios: arrow keys move between steps; each is named by its step, described by its criterion. */}
      <fieldset className="flex flex-col gap-2" aria-describedby={proficiency['aria-describedby']}>
        <legend className="mb-2 text-body-sm font-medium">Proficiency</legend>
        <p
          id={`${fieldId('proficiency')}-hint`}
          className="text-caption break-keep text-muted-foreground"
        >
          Choose the step closest to what you can do today.
        </p>
        <div className="flex flex-col gap-1">
          {proficiencyLevels.map((level, index) => {
            // The first radio carries the field id, so a message about the field moves focus here.
            const id =
              index === 0 ? fieldId('proficiency') : `${fieldId('proficiency')}-${level.value}`;
            // Named by the step alone, so each arrow-key move reads "4 · Advanced" first; the criterion and
            // any message about the field follow as its description.
            const describedBy = [
              `${id}-criterion`,
              invalid ? `${fieldId('proficiency')}-error` : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <label
                key={level.value}
                htmlFor={id}
                className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-transparent px-3 py-2 has-checked:border-input has-checked:bg-accent has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50"
              >
                <input
                  id={id}
                  type="radio"
                  name={fieldId('proficiency')}
                  value={String(level.value)}
                  checked={form.proficiency === String(level.value)}
                  onChange={(e) => set('proficiency')(e.target.value)}
                  aria-labelledby={`${id}-title`}
                  aria-describedby={describedBy}
                  className="mt-1 size-4 shrink-0 accent-primary"
                />
                <span className="flex flex-col text-body-sm font-medium">
                  <span id={`${id}-title`}>{`${String(level.value)} · ${level.name}`}</span>
                  <span
                    id={`${id}-criterion`}
                    className="font-normal break-keep text-muted-foreground"
                  >
                    {level.criterion}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        {errorFor('proficiency')}
      </fieldset>
      <div className="flex flex-col gap-2">
        <Label htmlFor={fieldId('memo')}>Notes</Label>
        <textarea
          id={fieldId('memo')}
          rows={3}
          maxLength={2000}
          className={cn(controlClass, 'min-h-20 py-2')}
          value={form.memo}
          onChange={(e) => set('memo')(e.target.value)}
          placeholder="Where you used it, for how long, etc."
          {...describe('memo')}
        />
        {errorFor('memo')}
      </div>
      {actions({ submitLabel, cancelTo })}
    </form>
  );
}

export function NewSkill({ paths }: { paths: SkillPaths }) {
  const navigate = useNavigate();
  const create = async (form: SkillForm) => {
    const { skill } = await skillApi.create(toSkillInput(form));
    toast.success(`Added '${skill.name}'`);
    void navigate(paths.list);
  };
  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <BackLink to={paths.list} label="Skill list" />
      <PageHeader
        title="Add skill"
        description="Choose a skill name, category, and proficiency. Notes can stay empty."
      />
      <SkillFields
        initial={emptySkillForm}
        submitLabel="Add"
        cancelTo={paths.list}
        onSubmit={create}
      />
    </section>
  );
}

export function EditSkill({ paths }: { paths: SkillPaths }) {
  const { id = '' } = useParams();
  // There is no single-item API (#34): the list is small, so the form finds its row there.
  const loaded = useLoad('all', loadSkills);
  const navigate = useNavigate();
  const skill =
    loaded.state === 'ok' ? loaded.data.skills.find((item) => String(item.id) === id) : undefined;
  const update = async (form: SkillForm) => {
    await skillApi.update(Number(id), toSkillInput(form));
    toast.success('Saved');
    void navigate(paths.list);
  };
  return (
    <section
      aria-labelledby="page-title"
      aria-busy={loaded.state === 'loading'}
      className="flex flex-col gap-6"
    >
      <BackLink to={paths.list} label="Skill list" />
      <PageHeader title="Edit skill" description="Change what you need, then save." />
      {loaded.state === 'loading' ? <SkeletonList rows={4} /> : null}
      {loaded.state === 'error' ? (
        <Notice
          notice={{ kind: 'error', text: `Could not load skills. ${errorText(loaded.error)}` }}
        />
      ) : null}
      {loaded.state === 'ok' && !skill ? (
        <Notice notice={{ kind: 'error', text: 'Skill not found. It may already be deleted.' }} />
      ) : null}
      {skill ? (
        <SkillFields
          // A new id starts a fresh form instead of keeping the previous row's typing.
          key={skill.id}
          initial={toSkillForm(skill)}
          submitLabel="Save"
          cancelTo={paths.list}
          onSubmit={update}
        />
      ) : null}
    </section>
  );
}
