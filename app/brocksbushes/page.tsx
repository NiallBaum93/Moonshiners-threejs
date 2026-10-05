import { Metadata } from 'next';
import { FieldToStill } from '@/components/field-to-still/FieldToStill';

export const metadata: Metadata = {
  title: 'Field to Still · Moonshiners × Brocksbushes',
  description: 'Strawberry Gin, Strawberry Liqueur and Pumpkin Spiced Rum. Picked at Brocksbushes Farm, distilled in Newcastle.',
}

export default function BrocksbushesPage() {
  return <FieldToStill />
}