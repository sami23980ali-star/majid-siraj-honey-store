export type HoneyOption = { label: string; price: number };

export type HoneyProduct = {
  id: number;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  origin: string;
  category: string;
  priceOptions: HoneyOption[];
  primaryImage: string;
  galleryImages: string[];
  galleryVideos: string[];
  inventoryCount: number;
  lowStockThreshold: number;
  isFeatured: boolean;
  isActive: boolean;
};

export type CartLine = {
  productId: number;
  name: string;
  image: string;
  option: HoneyOption;
  quantity: number;
};

export type StoredOrderLine = CartLine & { lineTotal: number };

export type ProductReview = {
  id: number;
  productId: number;
  customerName: string;
  rating: number;
  comment: string;
  imageUrl: string | null;
  createdAt: Date;
};
