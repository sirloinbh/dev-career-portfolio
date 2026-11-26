import { type ReactNode, useState } from 'react';

import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { useListQuery, useRefreshList } from './list-query';
import { skillApi, skillList } from './skill-data';

/** The most skills one project can have (the server refuses more). */
const maxSkills = 30;

/**
 * The skills a project used (#225): a checkbox for each skill in the skills list, and a way to add a skill that is
 * not there yet without leaving the form. A new skill starts as category "Other" at the lowest level; the Skills
 * screen is where to change that. A name that matches an existing skill (letters and spaces ignored) picks it.
 */
export function ProjectSkillPicker({
  value,
  onChange,
  error,
}: {
  value: number[];
  onChange: (ids: number[]) => void;
  /** The server's message about the field, shown under the picker. */
  error?: ReactNode;
}) {
  const { rows: skills } = useListQuery(skillList);
  const refresh = useRefreshList(skillList.path);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [adding, setAdding] = useState(false);

  const toggle = (id: number, checked: boolean) =>
    onChange(checked ? [...value, id] : value.filter((picked) => picked !== id));

  async function add() {
    const wanted = name.trim();
    if (wanted === '') {
      setNote('Enter a skill name first.');
      return;
    }
    const known = skills?.find((skill) => skill.name.trim().toLowerCase() === wanted.toLowerCase());
    if (known) {
      if (!value.includes(known.id)) onChange([...value, known.id]);
      setName('');
      setNote(`${known.name} is already in your skills list, so it is checked.`);
      return;
    }
    setAdding(true);
    try {
      const { skill } = await skillApi.create({
        name: wanted,
        category: 'other',
        proficiency: 1,
        memo: '',
      });
      await refresh();
      onChange([...value, skill.id]);
      setName('');
      setNote(`${skill.name} was added to your skills list as Other, level 1.`);
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Could not add the skill.');
    } finally {
      setAdding(false);
    }
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-body-sm font-medium">Skills used</legend>
      <p className="text-caption break-keep text-muted-foreground">
        Check the skills from your list that this project used. Up to {maxSkills}.
      </p>
      {skills && skills.length > 0 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-2">
          {skills.map((skill) => (
            <li key={skill.id}>
              <label className="flex items-center gap-2 text-body-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={value.includes(skill.id)}
                  onChange={(e) => toggle(skill.id, e.target.checked)}
                />
                <span className="wrap-anywhere break-keep">{skill.name}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body-sm text-muted-foreground">
          {skills ? 'No skills yet. Add one below.' : 'Loading skills'}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-skill-name">New skill</Label>
        <div className="flex max-w-md gap-2">
          <Input
            id="new-skill-name"
            maxLength={50}
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              // Enter here adds the skill; it must not submit the whole project form.
              if (e.key === 'Enter') {
                e.preventDefault();
                void add();
              }
            }}
            placeholder="e.g. Terraform"
          />
          <Button type="button" variant="outline" disabled={adding} onClick={() => void add()}>
            Add skill
          </Button>
        </div>
        <p role="status" className="text-caption break-keep text-muted-foreground">
          {note}
        </p>
      </div>
      {error}
    </fieldset>
  );
}
