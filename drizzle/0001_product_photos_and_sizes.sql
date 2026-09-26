CREATE TABLE "inventory"."product_image" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"product_id" text NOT NULL,
	"storage_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory"."product" ADD COLUMN "variant" text;--> statement-breakpoint
ALTER TABLE "inventory"."product_image" ADD CONSTRAINT "product_image_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "inventory"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."product_image" ADD CONSTRAINT "product_image_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "inventory"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."product_image" ADD CONSTRAINT "product_image_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "inventory"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_image_product_idx" ON "inventory"."product_image" USING btree ("product_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "product_org_name_variant_uq" ON "inventory"."product" USING btree ("organization_id",lower("name"),lower(coalesce("variant", '')));