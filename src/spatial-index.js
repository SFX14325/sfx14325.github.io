export class SpatialGrid {
 constructor(nodes,cell_size=128){this.cell_size=cell_size;this.cells=new Map();for(const node of nodes){const key=this.key(node.x,node.y);if(!this.cells.has(key))this.cells.set(key,[]);this.cells.get(key).push(node);}}
 key(x,y){return `${Math.floor(x/this.cell_size)},${Math.floor(y/this.cell_size)}`;}
 query(x0,y0,x1,y1){const result=[];for(let x=Math.floor(x0/this.cell_size);x<=Math.floor(x1/this.cell_size);x++)for(let y=Math.floor(y0/this.cell_size);y<=Math.floor(y1/this.cell_size);y++)for(const n of this.cells.get(`${x},${y}`)||[])if(n.x>=x0&&n.x<=x1&&n.y>=y0&&n.y<=y1)result.push(n);return result;}
}
