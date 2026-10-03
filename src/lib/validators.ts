import React from 'react';

/**
 * Módulo de validación y formateo estricto para Teléfono (Perú) y DNI.
 * Sistema Acicalados Spa & Barber Shop
 */

export const PHONE_LENGTH = 9;
export const DNI_LENGTH = 8;

export const PHONE_PLACEHOLDER = 'Ej. 991044301';
export const DNI_PLACEHOLDER = 'Ej. 72345678';

export const PHONE_ERROR_MESSAGE = 'El teléfono debe contener exactamente 9 dígitos';
export const DNI_ERROR_MESSAGE = 'El DNI debe tener exactamente 8 dígitos';

/**
 * Limpia cualquier carácter no numérico y recorta a una longitud máxima.
 */
export function cleanNumeric(value: string | null | undefined, maxLength: number): string {
  if (!value) return '';
  return value.replace(/\D/g, '').slice(0, maxLength);
}

/**
 * Sanitiza la entrada de un teléfono peruano (9 dígitos).
 * Si el usuario pega un número con prefijo internacional +51 o 51 (ej. +51 991 044 301),
 * extrae inteligentemente los 9 dígitos móviles correspondientes.
 */
export function sanitizePhone(value: string | null | undefined): string {
  if (!value) return '';
  let digits = value.replace(/\D/g, '');
  // Si comienza con 51 y tiene más de 9 dígitos (ej. 51991044301)
  if (digits.startsWith('51') && digits.length > 9) {
    digits = digits.slice(2);
  }
  return digits.slice(0, PHONE_LENGTH);
}

/**
 * Sanitiza la entrada de un DNI peruano (8 dígitos numéricos).
 */
export function sanitizeDni(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\D/g, '').slice(0, DNI_LENGTH);
}

/**
 * Verifica si un teléfono cumple con exactamente 9 dígitos numéricos.
 */
export function isValidPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  return /^\d{9}$/.test(phone.trim());
}

/**
 * Verifica si un DNI cumple con exactamente 8 dígitos numéricos.
 */
export function isValidDni(dni: string | null | undefined): boolean {
  if (!dni) return false;
  return /^\d{8}$/.test(dni.trim());
}

/**
 * Interceptor onKeyDown para bloquear en tiempo real cualquier tecla no numérica.
 * Permite teclas de control: Backspace, Tab, Delete, Flechas, Enter, Copiar/Pegar/Cortar/Seleccionar (Ctrl/Cmd).
 */
export function handleNumericKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
  // Permitir teclas de atajo con Ctrl o Meta (Cmd en Mac)
  if (e.ctrlKey || e.metaKey) {
    return;
  }

  // Teclas de navegación y edición estándar
  const allowedKeys = [
    'Backspace',
    'Delete',
    'Tab',
    'Enter',
    'Escape',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Home',
    'End',
  ];

  if (allowedKeys.includes(e.key)) {
    return;
  }

  // Permitir solo números 0-9
  if (!/^[0-9]$/.test(e.key)) {
    e.preventDefault();
  }
}
