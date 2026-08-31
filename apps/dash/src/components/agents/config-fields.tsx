"use client";

import {
  Description,
  Input,
  Label,
  ListBox,
  NumberField,
  Select,
  Switch,
  TextArea,
  TextField,
} from "@heroui/react";
import { Controller } from "react-hook-form";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import * as z from "zod";

import type { JsonObject, JsonValue } from "@chia/utils/json";
import { asNumber, asString } from "@chia/utils/json";

/**
 * A kind's `config` as form fields, rendered from the JSON Schema the kind's zod schema
 * produces. Covers the field shapes a preference can reasonably take — text, number,
 * boolean, a fixed choice — and says so for anything else rather than rendering a wrong
 * control.
 *
 * The form value is the *override* with every schema property present, "unset" spelled as
 * `""` for text and `null` otherwise, so react-hook-form's dirty check compares like with
 * like; {@link configOverrideOf} folds those back out before the write.
 */

/** The slice of JSON Schema this form reads; anything else in the document is ignored. */
const propertySchema = z.object({
  type: z.union([z.string(), z.array(z.string())]).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  maxLength: z.number().optional(),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  enum: z.array(z.json()).optional(),
});

const objectSchema = z.compile(
  z.object({
    properties: z.record(z.string(), propertySchema).optional(),
  })
);

type Property = z.infer<typeof propertySchema>;

/** One form field's value; see the module note. */
export const configFieldValueSchema = z.compile(
  z.union([z.string(), z.number(), z.boolean(), z.null()])
);

export type ConfigFieldValue = z.infer<typeof configFieldValueSchema>;
export type ConfigFormValue = Record<string, ConfigFieldValue>;

/** Text a kind may reasonably want a paragraph of gets a textarea; a short string an input. */
const LONG_TEXT_THRESHOLD = 200;

const propertiesOf = (schema: JsonObject): [string, Property][] =>
  Object.entries(objectSchema.safeParse(schema).data?.properties ?? {});

const typeOf = (property: Property): string | undefined =>
  Array.isArray(property.type)
    ? property.type.find((t) => t !== "null")
    : property.type;

const isText = (property: Property) =>
  property.enum !== undefined || typeOf(property) === "string";

/** The form's starting value for a kind: the override row spread over every schema property. */
export const configFormValueOf = (
  schema: JsonObject,
  override: JsonObject
): ConfigFormValue =>
  Object.fromEntries(
    propertiesOf(schema).map(([key, property]) => {
      const current = override[key];
      const parsed = configFieldValueSchema.safeParse(current);
      const value = parsed.success ? parsed.data : null;
      return [key, isText(property) ? (asString(value) ?? "") : value];
    })
  );

/** The override to write: unset fields dropped, so the code default applies to them. */
export const configOverrideOf = (value: ConfigFormValue): JsonObject =>
  Object.fromEntries(
    Object.entries(value).filter(
      ([, field]) => field !== null && field !== "" && !Number.isNaN(field)
    )
  );

const humanize = (key: string) =>
  key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (c) => c.toUpperCase());

const describe = (property: Property, fallback: JsonValue | undefined) => {
  const parts = [property.description];
  if (fallback !== undefined && fallback !== "") {
    parts.push(`Default: ${JSON.stringify(fallback)}`);
  }
  const text = parts.filter(Boolean).join(" ");
  return text ? <Description className="text-xs">{text}</Description> : null;
};

export interface ConfigFieldsProps<TValues extends FieldValues> {
  control: Control<TValues>;
  /** The form field the config object lives under, e.g. `"config"`. */
  name: string;
  schema: JsonObject;
  defaults: JsonObject;
  isDisabled?: boolean;
}

export const ConfigFields = <TValues extends FieldValues>({
  control,
  defaults,
  isDisabled,
  name,
  schema,
}: ConfigFieldsProps<TValues>) => {
  const entries = propertiesOf(schema);
  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        This agent has no configuration of its own.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {entries.map(([key, property]) => {
        const label = property.title ?? humanize(key);
        const fallback = defaults[key];
        const type = typeOf(property);
        /* SAFETY: the form's values put the config object under `name`, keyed by schema property. */
        const path = `${name}.${key}` as FieldPath<TValues>;

        return (
          <Controller
            key={key}
            control={control}
            name={path}
            render={({ field }) => {
              const current =
                configFieldValueSchema.safeParse(field.value).data ?? null;

              if (property.enum) {
                const items = property.enum.map((option) => ({
                  id: String(option),
                  label: String(option),
                }));
                return (
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">{label}</Label>
                    <Select
                      aria-label={label}
                      className="w-full"
                      isDisabled={isDisabled}
                      onChange={(id) => field.onChange(String(id))}
                      value={asString(current) ?? ""}>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox
                          items={[{ id: "", label: "Default" }, ...items]}>
                          {(item) => (
                            <ListBox.Item id={item.id}>
                              {item.label}
                            </ListBox.Item>
                          )}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                    {describe(property, fallback)}
                  </div>
                );
              }

              switch (type) {
                case "string": {
                  const text = asString(current) ?? "";
                  const placeholder = asString(fallback);
                  const long = (property.maxLength ?? 0) > LONG_TEXT_THRESHOLD;
                  return long ? (
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">{label}</Label>
                      <TextArea
                        aria-label={label}
                        className="font-mono text-xs"
                        disabled={isDisabled}
                        maxLength={property.maxLength}
                        onBlur={field.onBlur}
                        onChange={(event) => field.onChange(event.target.value)}
                        placeholder={placeholder}
                        rows={8}
                        value={text}
                      />
                      {describe(property, fallback)}
                    </div>
                  ) : (
                    <TextField
                      aria-label={label}
                      isDisabled={isDisabled}
                      maxLength={property.maxLength}
                      onBlur={field.onBlur}
                      onChange={field.onChange}
                      value={text}>
                      <Label className="text-xs">{label}</Label>
                      <Input placeholder={placeholder} />
                      {describe(property, fallback)}
                    </TextField>
                  );
                }
                case "number":
                case "integer":
                  return (
                    <NumberField
                      aria-label={label}
                      isDisabled={isDisabled}
                      maxValue={property.maximum}
                      minValue={property.minimum}
                      onBlur={field.onBlur}
                      onChange={(next) =>
                        field.onChange(Number.isNaN(next) ? null : next)
                      }
                      step={type === "integer" ? 1 : undefined}
                      value={asNumber(current) ?? Number.NaN}>
                      <Label className="text-xs">{label}</Label>
                      <NumberField.Group>
                        <NumberField.DecrementButton />
                        <NumberField.Input className="w-32" />
                        <NumberField.IncrementButton />
                      </NumberField.Group>
                      {describe(property, fallback)}
                    </NumberField>
                  );
                case "boolean":
                  return (
                    <Switch
                      isDisabled={isDisabled}
                      isSelected={current === true}
                      onBlur={field.onBlur}
                      onChange={(selected) =>
                        field.onChange(selected ? true : null)
                      }>
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                      <Switch.Content>
                        <Label className="text-xs">{label}</Label>
                        {describe(property, fallback)}
                      </Switch.Content>
                    </Switch>
                  );
                default:
                  return (
                    <p className="text-muted-foreground text-xs">
                      <span className="font-medium">{label}</span> has a shape
                      this form does not render ({type ?? "unknown"}); edit it
                      in code.
                    </p>
                  );
              }
            }}
          />
        );
      })}
    </div>
  );
};
