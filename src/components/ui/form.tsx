"use client";

import * as React from 'react';
import { useFormContext, FormProvider, Controller } from 'react-hook-form';
import { cn } from '@/lib/utils';

/**
 * Form – wraps children with React Hook Form context.
 */
export function Form({ children, ...props }: any) {
  return <FormProvider {...props}>{children}</FormProvider>;
}

/**
 * Field-level context to share information between FormField and its children (like FormMessage).
 */
const FormFieldContext = React.createContext<{ name: string }>({ name: '' });

/**
 * FormField – connects a field name to the form context.
 */
export function FormField({ name, render }: { name: string; render: (field: any) => React.ReactNode }) {
  const { control } = useFormContext();
  return (
    <FormFieldContext.Provider value={{ name }}>
      <Controller name={name} control={control} render={render} />
    </FormFieldContext.Provider>
  );
}

/**
 * FormItem – simple wrapper for layout.
 */
export function FormItem({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('space-y-1', className)} {...props}>
      {children}
    </div>
  );
}

/**
 * FormLabel – label for a form field.
 */
export function FormLabel({ children, className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn('text-sm font-medium text-foreground', className)} {...props}>
      {children}
    </label>
  );
}

/**
 * FormControl – wrapper around the actual input component.
 */
export function FormControl({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex w-full items-center space-x-2', className)} {...props}>
      {children}
    </div>
  );
}

/**
 * FormMessage – displays validation error messages automatically based on field name.
 */
export function FormMessage({ children }: { children?: React.ReactNode }) {
  const { name } = React.useContext(FormFieldContext);
  const { formState } = useFormContext();
  
  if (children) {
    return <p className="text-sm text-destructive">{children}</p>;
  }

  const error = formState.errors[name];
  if (!error) {
    return null;
  }

  return <p className="text-sm font-medium text-destructive">{String(error.message)}</p>;
}

/**
 * FormDescription – optional description under a field.
 */
export function FormDescription({ children }: { children?: React.ReactNode }) {
  return children ? <p className={cn('text-sm text-muted-foreground')}> {children} </p> : null;
}

/**
 * Export all components for '@/components/ui/form' imports.
 */
export const FormComponents = {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
};

export default FormComponents;
