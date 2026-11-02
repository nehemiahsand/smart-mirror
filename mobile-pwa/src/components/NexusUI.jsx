import React, { useEffect, useId, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import {
    Alert,
    Badge,
    Button as MantineButton,
    Modal as MantineModal,
    Switch as MantineSwitch
} from '@mantine/core';
import { m, useReducedMotion } from 'motion/react';

export function Button({
    className = '',
    children,
    disabled,
    type = 'button',
    ...props
}) {
    const reduced = useReducedMotion();
    const primary = className.split(' ').includes('primary');
    const danger = className.split(' ').includes('danger');
    return (
        <MantineButton
            component={m.button}
            type={type}
            disabled={disabled}
            variant={primary ? 'filled' : 'default'}
            color={danger ? 'red' : undefined}
            className={`nexus-ui-button ${className}`}
            whileHover={disabled || reduced ? undefined : { y: -2 }}
            whileTap={disabled || reduced ? undefined : { y: 1 }}
            transition={{ duration: reduced ? 0 : 0.16 }}
            {...props}
        >
            {children}
        </MantineButton>
    );
}
export function Surface({ children, className = '', ...props }) {
    const reduced = useReducedMotion();
    return (
        <m.section
            className={`surface ${className}`}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: reduced ? 0 : 0.22 }}
            {...props}
        >
            {children}
        </m.section>
    );
}
export function Heading({ title, children }) {
    return (
        <div className="page-heading">
            <h1>{title}</h1>
            {children && <p>{children}</p>}
        </div>
    );
}
export function Subnav({ base, items }) {
    const id = useId();
    const reduced = useReducedMotion();
    return (
        <nav className="nexus-subnav" aria-label={`${base} views`}>
            {items.map(([key, label]) => (
                <NavLink key={key} to={`/${base}/${key}`}>
                    {({ isActive }) => (
                        <>
                            {isActive && (
                                <m.span
                                    className="subnav-indicator"
                                    layoutId={`${id}-subnav`}
                                    transition={{ duration: reduced ? 0 : 0.2 }}
                                />
                            )}
                            <span className="subnav-label">{label}</span>
                        </>
                    )}
                </NavLink>
            ))}
        </nav>
    );
}
export function Notice({ error, message }) {
    if (!error && !message) return null;
    return (
        <Alert
            className="nexus-notice"
            color={error ? 'red' : 'nexus'}
            variant="light"
            role={error ? 'alert' : 'status'}
        >
            {error || message}
        </Alert>
    );
}
export function Disclosure({ title, children, open, ...props }) {
    return (
        <details className="nexus-disclosure" open={open} {...props}>
            <summary>
                {title}
                <ChevronDown />
            </summary>
            <div>{children}</div>
        </details>
    );
}
export function Switch({ label, checked, onChange, disabled = false }) {
    return (
        <MantineSwitch
            className="nexus-control-switch"
            aria-label={label}
            role="switch"
            checked={!!checked}
            onChange={onChange}
            disabled={disabled}
            size="md"
        />
    );
}
export function Modal({ title, children, onClose }) {
    const reduced = useReducedMotion();
    const returnTarget = useRef(document.activeElement);
    // These dialogs unmount on close, so restore focus after their portal is removed.
    useEffect(
        () => () => {
            queueMicrotask(() => {
                if (
                    returnTarget.current?.isConnected &&
                    document.activeElement === document.body
                ) {
                    returnTarget.current.focus({ preventScroll: true });
                }
            });
        },
        []
    );
    return (
        <MantineModal
            opened
            title={title}
            onClose={onClose}
            centered
            returnFocus={false}
            lockScroll
            closeButtonProps={{ 'aria-label': 'Close dialog' }}
            transitionProps={{ transition: 'pop', duration: reduced ? 0 : 160 }}
            overlayProps={{ backgroundOpacity: 0.55, blur: 6 }}
            classNames={{
                content: 'nexus-modal',
                header: 'nexus-modal-header',
                title: 'nexus-modal-title',
                body: 'nexus-modal-body'
            }}
        >
            {children}
        </MantineModal>
    );
}
export function Confirmation({
    title,
    text,
    confirmText = 'Confirm',
    onConfirm,
    onClose,
    busy,
    error
}) {
    return (
        <Modal title={title} onClose={busy ? () => {} : onClose}>
            <p>{text}</p>
            <Notice error={error} />
            <div className="button-row">
                <Button className="primary" disabled={busy} onClick={onConfirm}>
                    {busy ? 'Working…' : confirmText}
                </Button>
                <Button disabled={busy} onClick={onClose}>
                    Cancel
                </Button>
            </div>
        </Modal>
    );
}
export function Status({ online, children }) {
    return (
        <Badge
            className="nexus-status"
            variant="light"
            color={online ? 'green' : 'gray'}
            leftSection={
                <span
                    className={`status-dot ${online ? 'online' : ''}`}
                    aria-hidden="true"
                />
            }
        >
            {children || (online ? 'Online' : 'Offline')}
        </Badge>
    );
}
