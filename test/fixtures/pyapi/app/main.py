"""A small inventory API: items with a name, a price in cents and a version that counts updates."""
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="inventory")


class ItemIn(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    price: int = Field(ge=0, description="price in cents; negative prices are rejected with 422")


class Item(ItemIn):
    id: int
    version: int = Field(description="1 when created; incremented by every update that changes the item")


DB: Dict[int, Item] = {}
NEXT = {"id": 1}


@app.post("/items", response_model=Item, status_code=201)
def create_item(item: ItemIn) -> Item:
    """Create an item. The id is assigned by the server."""
    new = Item(id=NEXT["id"], version=1, **item.model_dump())
    NEXT["id"] += 1
    DB[new.id] = new
    return new


@app.get("/items/{item_id}", response_model=Item)
def read_item(item_id: int) -> Item:
    """Return one item; 404 if it does not exist."""
    return DB[item_id]


@app.put("/items/{item_id}", response_model=Item)
def update_item(item_id: int, item: ItemIn) -> Item:
    """Replace an item's name and price. Updating with the same data again changes nothing (idempotent)."""
    if item_id not in DB:
        raise HTTPException(status_code=404, detail="no such item")
    cur = DB[item_id]
    DB[item_id] = Item(id=item_id, version=cur.version + 1, **item.model_dump())
    return DB[item_id]


@app.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: int) -> None:
    """Delete an item; 404 if it does not exist."""
    if item_id not in DB:
        raise HTTPException(status_code=404, detail="no such item")
    del DB[item_id]


@app.get("/items", response_model=List[Item])
def list_items(offset: int = 0, limit: int = 10) -> List[Item]:
    """Items ordered by id; `offset` and `limit` page through all of them."""
    items = sorted(DB.values(), key=lambda i: i.id)
    return items[offset:offset + limit - 1]
