import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Product {
  id: string;
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  affiliateLink: string;
  category: string;
}

const products: Product[] = [
  {
    id: '1',
    name: 'Hair Growth Serum',
    description: 'Advanced formula with biotin and keratin for stronger, healthier hair',
    price: '$29.99',
    imageUrl: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=400',
    affiliateLink: '#',
    category: 'Serum'
  },
  {
    id: '2',
    name: 'Anti-Hairfall Shampoo',
    description: 'Reduces hair fall by 90% with natural ingredients',
    price: '$19.99',
    imageUrl: 'https://images.unsplash.com/photo-1631729371254-42c2892f0e6e?w=400',
    affiliateLink: '#',
    category: 'Shampoo'
  },
  {
    id: '3',
    name: 'Vitamin Hair Supplement',
    description: 'Essential vitamins and minerals for hair health',
    price: '$34.99',
    imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400',
    affiliateLink: '#',
    category: 'Supplement'
  },
  {
    id: '4',
    name: 'Hair Nourishing Oil',
    description: 'Natural oils blend for deep nourishment and shine',
    price: '$24.99',
    imageUrl: 'https://images.unsplash.com/photo-1571875257727-256c39da42af?w=400',
    affiliateLink: '#',
    category: 'Oil'
  },
  {
    id: '5',
    name: 'Scalp Treatment Mask',
    description: 'Weekly treatment for healthy scalp and hair growth',
    price: '$39.99',
    imageUrl: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400',
    affiliateLink: '#',
    category: 'Treatment'
  },
  {
    id: '6',
    name: 'Hair Repair Conditioner',
    description: 'Deep conditioning formula for damaged hair',
    price: '$22.99',
    imageUrl: 'https://images.unsplash.com/photo-1571875257727-256c39da42af?w=400',
    affiliateLink: '#',
    category: 'Conditioner'
  }
];

export const AffiliateProducts = () => {
  return (
    <section className="pt-4 pb-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">Hair Care Shop</h2>
        <p className="text-sm text-muted-foreground">
          Premium products for healthy, beautiful hair
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {products.map((product) => (
          <Card key={product.id} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex gap-4 p-4">
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-24 h-24 object-cover rounded-lg"
                />
                <div className="flex-1 space-y-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-base">{product.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {product.category}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {product.description}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-primary">
                      {product.price}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => window.open(product.affiliateLink, '_blank')}
                      className="bg-primary text-primary-foreground"
                    >
                      Buy Now
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};
