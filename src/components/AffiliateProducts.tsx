import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, ShoppingCart, Heart } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string;
  price: string;
  originalPrice: string;
  discount: string;
  imageUrl: string;
  affiliateLink: string;
  category: string;
  rating: number;
  reviews: number;
}

const products: Product[] = [
  {
    id: '1',
    name: 'Hair Growth Serum',
    description: 'Advanced formula with biotin and keratin',
    price: '$29.99',
    originalPrice: '$49.99',
    discount: '40% OFF',
    imageUrl: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=500&q=80',
    affiliateLink: '#',
    category: 'Serum',
    rating: 4.5,
    reviews: 248
  },
  {
    id: '2',
    name: 'Anti-Hairfall Shampoo',
    description: 'Reduces hair fall by 90%',
    price: '$19.99',
    originalPrice: '$29.99',
    discount: '33% OFF',
    imageUrl: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=500&q=80',
    affiliateLink: '#',
    category: 'Shampoo',
    rating: 4.8,
    reviews: 532
  },
  {
    id: '3',
    name: 'Vitamin Hair Supplement',
    description: 'Essential vitamins for hair health',
    price: '$34.99',
    originalPrice: '$54.99',
    discount: '36% OFF',
    imageUrl: 'https://images.unsplash.com/photo-1550572017-4367-5137-91c4-9e9f5a8d2d04?w=500&q=80',
    affiliateLink: '#',
    category: 'Supplement',
    rating: 4.6,
    reviews: 189
  },
  {
    id: '4',
    name: 'Hair Nourishing Oil',
    description: 'Natural oils for deep nourishment',
    price: '$24.99',
    originalPrice: '$39.99',
    discount: '38% OFF',
    imageUrl: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=500&q=80',
    affiliateLink: '#',
    category: 'Oil',
    rating: 4.7,
    reviews: 421
  },
  {
    id: '5',
    name: 'Scalp Treatment Mask',
    description: 'Weekly treatment for healthy scalp',
    price: '$39.99',
    originalPrice: '$59.99',
    discount: '33% OFF',
    imageUrl: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500&q=80',
    affiliateLink: '#',
    category: 'Treatment',
    rating: 4.4,
    reviews: 156
  },
  {
    id: '6',
    name: 'Hair Repair Conditioner',
    description: 'Deep conditioning for damaged hair',
    price: '$22.99',
    originalPrice: '$34.99',
    discount: '34% OFF',
    imageUrl: 'https://images.unsplash.com/photo-1631729371254-42c2892f0e6e?w=500&q=80',
    affiliateLink: '#',
    category: 'Conditioner',
    rating: 4.5,
    reviews: 312
  },
  {
    id: '7',
    name: 'Keratin Hair Serum',
    description: 'Intense keratin boost for stronger hair',
    price: '$32.99',
    originalPrice: '$52.99',
    discount: '38% OFF',
    imageUrl: 'https://images.unsplash.com/photo-1556228852-80f637384e31?w=500&q=80',
    affiliateLink: '#',
    category: 'Serum',
    rating: 4.6,
    reviews: 298
  },
  {
    id: '8',
    name: 'Moisturizing Shampoo',
    description: 'Hydrating formula for dry hair',
    price: '$17.99',
    originalPrice: '$26.99',
    discount: '33% OFF',
    imageUrl: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=500&q=80',
    affiliateLink: '#',
    category: 'Shampoo',
    rating: 4.4,
    reviews: 410
  },
  {
    id: '9',
    name: 'Biotin Hair Gummies',
    description: 'Delicious way to boost hair growth',
    price: '$27.99',
    originalPrice: '$42.99',
    discount: '35% OFF',
    imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&q=80',
    affiliateLink: '#',
    category: 'Supplement',
    rating: 4.7,
    reviews: 567
  },
  {
    id: '10',
    name: 'Argan Hair Oil',
    description: 'Organic argan oil for silky hair',
    price: '$26.99',
    originalPrice: '$41.99',
    discount: '36% OFF',
    imageUrl: 'https://images.unsplash.com/photo-1612817288484-6f916006741a?w=500&q=80',
    affiliateLink: '#',
    category: 'Oil',
    rating: 4.8,
    reviews: 634
  },
  {
    id: '11',
    name: 'Deep Repair Treatment',
    description: 'Professional-grade hair repair',
    price: '$44.99',
    originalPrice: '$69.99',
    discount: '36% OFF',
    imageUrl: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=500&q=80',
    affiliateLink: '#',
    category: 'Treatment',
    rating: 4.9,
    reviews: 289
  },
  {
    id: '12',
    name: 'Volumizing Conditioner',
    description: 'Adds volume and thickness',
    price: '$21.99',
    originalPrice: '$32.99',
    discount: '33% OFF',
    imageUrl: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=500&q=80',
    affiliateLink: '#',
    category: 'Conditioner',
    rating: 4.3,
    reviews: 276
  },
  {
    id: '13',
    name: 'Anti-Frizz Serum',
    description: 'Controls frizz all day long',
    price: '$24.99',
    originalPrice: '$39.99',
    discount: '38% OFF',
    imageUrl: 'https://images.unsplash.com/photo-1526045612212-70caf35c14df?w=500&q=80',
    affiliateLink: '#',
    category: 'Serum',
    rating: 4.5,
    reviews: 445
  },
  {
    id: '14',
    name: 'Color Protect Shampoo',
    description: 'Keeps color vibrant longer',
    price: '$23.99',
    originalPrice: '$35.99',
    discount: '33% OFF',
    imageUrl: 'https://images.unsplash.com/photo-1555351189-0446e7ab6d14?w=500&q=80',
    affiliateLink: '#',
    category: 'Shampoo',
    rating: 4.6,
    reviews: 387
  },
  {
    id: '15',
    name: 'Collagen Hair Capsules',
    description: 'Strengthens from within',
    price: '$31.99',
    originalPrice: '$49.99',
    discount: '36% OFF',
    imageUrl: 'https://images.unsplash.com/photo-1550572017-4367-5137-91c4-9e9f5a8d2d04?w=500&q=80',
    affiliateLink: '#',
    category: 'Supplement',
    rating: 4.5,
    reviews: 198
  },
  {
    id: '16',
    name: 'Coconut Hair Oil',
    description: 'Pure coconut oil for shine',
    price: '$18.99',
    originalPrice: '$29.99',
    discount: '37% OFF',
    imageUrl: 'https://images.unsplash.com/photo-1608516207565-c3ccfb7c8c89?w=500&q=80',
    affiliateLink: '#',
    category: 'Oil',
    rating: 4.6,
    reviews: 512
  },
  {
    id: '17',
    name: 'Hot Oil Treatment',
    description: 'Intensive weekly care',
    price: '$36.99',
    originalPrice: '$54.99',
    discount: '33% OFF',
    imageUrl: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500&q=80',
    affiliateLink: '#',
    category: 'Treatment',
    rating: 4.7,
    reviews: 234
  },
  {
    id: '18',
    name: 'Smoothing Conditioner',
    description: 'For silky smooth results',
    price: '$19.99',
    originalPrice: '$31.99',
    discount: '38% OFF',
    imageUrl: 'https://images.unsplash.com/photo-1631729371254-42c2892f0e6e?w=500&q=80',
    affiliateLink: '#',
    category: 'Conditioner',
    rating: 4.4,
    reviews: 356
  }
];

const categories = ['All', 'Serum', 'Shampoo', 'Oil', 'Treatment', 'Supplement', 'Conditioner'];

export const AffiliateProducts = () => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());

  const filteredProducts = selectedCategory === 'All' 
    ? products 
    : products.filter(p => p.category === selectedCategory);

  const toggleWishlist = (id: string) => {
    const newWishlist = new Set(wishlist);
    if (newWishlist.has(id)) {
      newWishlist.delete(id);
    } else {
      newWishlist.add(id);
    }
    setWishlist(newWishlist);
  };

  return (
    <section className="pt-4 pb-6">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold mb-1">Hair Care Shop</h2>
        <p className="text-sm text-muted-foreground">
          Premium products for healthy, beautiful hair
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide px-1">
        {categories.map((category) => (
          <Badge
            key={category}
            variant={selectedCategory === category ? "default" : "outline"}
            className="cursor-pointer whitespace-nowrap transition-all hover:scale-105 text-xs px-3 py-1"
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </Badge>
        ))}
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 animate-fade-in">
        {filteredProducts.map((product) => (
          <Card 
            key={product.id} 
            className="group overflow-hidden border-border hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
          >
            <CardContent className="p-0">
              {/* Image Container */}
              <div className="relative overflow-hidden aspect-square">
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
                <div className="absolute top-2 left-2">
                  <Badge className="bg-primary text-primary-foreground text-[10px] sm:text-xs px-2 py-0.5">
                    {product.discount}
                  </Badge>
                </div>
                <button
                  onClick={() => toggleWishlist(product.id)}
                  className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full p-1.5 transition-all hover:scale-110 active:scale-95"
                  aria-label="Add to wishlist"
                >
                  <Heart 
                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${wishlist.has(product.id) ? 'fill-red-500 text-red-500' : 'text-foreground'}`}
                  />
                </button>
              </div>

              {/* Product Details */}
              <div className="p-2 sm:p-3 space-y-1.5 sm:space-y-2">
                <div>
                  <h3 className="font-semibold text-xs sm:text-sm line-clamp-2 mb-0.5 sm:mb-1 group-hover:text-primary transition-colors">
                    {product.name}
                  </h3>
                  <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1">
                    {product.description}
                  </p>
                </div>

                {/* Rating */}
                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-primary/10 rounded">
                    <span className="text-[10px] sm:text-xs font-semibold">{product.rating}</span>
                    <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-primary text-primary" />
                  </div>
                  <span className="text-[10px] sm:text-xs text-muted-foreground">({product.reviews})</span>
                </div>

                {/* Price */}
                <div className="flex items-baseline gap-1.5 sm:gap-2">
                  <span className="text-base sm:text-lg font-bold text-foreground">{product.price}</span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground line-through">{product.originalPrice}</span>
                </div>

                {/* Add to Cart Button */}
                <Button
                  size="sm"
                  onClick={() => window.open(product.affiliateLink, '_blank')}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all group-hover:shadow-md text-xs sm:text-sm py-1.5 sm:py-2 active:scale-95"
                >
                  <ShoppingCart className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  Buy Now
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Hide scrollbar */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </section>
  );
};
