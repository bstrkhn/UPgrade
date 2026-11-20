import { Router } from 'express';
import { validateZod } from '../../middlewares/validateZod.js';
import { requireUserId } from '../../utils/requestUser.js';
import { sendSuccess } from '../../utils/response.js';
import { idParamSchema } from '../accounts/accounts.schemas.js';
import { createCategorySchema, listCategoriesQuerySchema } from './categories.schemas.js';
import { createCategory, deleteCategory, listCategories, toPublicCategory } from './categories.service.js';

export const categoriesRouter = Router();

categoriesRouter.get('/', validateZod({ query: listCategoriesQuerySchema }), async (req, res) => {
  const query = req.query as { kind?: 'INCOME' | 'ESSENTIAL' | 'DISCRETIONARY' };
  const categories = await listCategories(requireUserId(req), query.kind);
  sendSuccess(res, 'Daftar kategori berhasil dimuat.', { categories: categories.map(toPublicCategory) });
});

categoriesRouter.post('/', validateZod({ body: createCategorySchema }), async (req, res) => {
  const category = await createCategory(requireUserId(req), req.body);
  sendSuccess(
    res,
    `Kategori "${category.name}" berhasil dibuat.`,
    { category: toPublicCategory(category) },
    { status: 201 },
  );
});

categoriesRouter.delete('/:id', validateZod({ params: idParamSchema }), async (req, res) => {
  await deleteCategory(requireUserId(req), String(req.params.id));
  sendSuccess(res, 'Kategori berhasil dihapus.', null);
});
