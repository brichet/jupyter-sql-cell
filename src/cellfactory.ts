import { CellChange, ISharedCodeCell } from '@jupyter/ydoc';
import { Cell, CodeCell, ICellHeader } from '@jupyterlab/cells';
import { Notebook, NotebookPanel } from '@jupyterlab/notebook';
import { PanelLayout } from '@lumino/widgets';

import { CellHeader } from './cellHeader';
import { ICustomCodeCell, MAGIC } from './common';
import { IKernelInjection } from './kernelInjection';
import { IDatabasesPanel } from './sidepanel';

/**
 * The notebook content factory.
 */
export class NotebookContentFactory
  extends Notebook.ContentFactory
  implements NotebookPanel.IContentFactory
{
  constructor(options: ContentFactory.IOptions) {
    super(options);
    this._databasesPanel = options.databasesPanel;
    this._kernelInjection = options.kernelInjection;
  }

  /**
   * Create a new content area for the panel.
   */
  createNotebook(options: Notebook.IOptions): Notebook {
    return new Notebook(options);
  }

  /**
   * Creates a new code cell widget, using a custom content factory.
   */
  createCodeCell(options: CodeCell.IOptions): CodeCell {
    const editorFactory = options.contentFactory.editorFactory;
    const databasesPanel = this._databasesPanel;
    const kernelInjection = this._kernelInjection;
    const cellContentFactory = new CellContentFactory({
      databasesPanel,
      editorFactory
    });
    const cell = new CustomCodeCell({
      ...options,
      contentFactory: cellContentFactory,
      kernelInjection
    }).initializeState();
    return cell;
  }

  private _databasesPanel: IDatabasesPanel;
  private _kernelInjection: IKernelInjection;
}

/**
 * The namespace for Notebook content factory.
 */
export namespace ContentFactory {
  /**
   * The content factory options.
   */
  export interface IOptions extends CellContentFactory.IOptions {
    /**
     * The kernel injection, whether the kernel can handle sql magics or not.
     */
    kernelInjection: IKernelInjection;
  }
}

/**
 * A custom code cell to copy the output in a variable when the cell is executed.
 */
class CustomCodeCell extends CodeCell implements ICustomCodeCell {
  constructor(options: CustomCodeCell.IOptions) {
    super(options);
    this._kernelInjection = options.kernelInjection;
    this.model.sharedModel.changed.connect(this._onSharedModelChanged, this);

    this._kernelInjection.statusChanged.connect(() => {
      this._checkSource();
    }, this);
  }

  /**
   * Getter and setter of the SQL status.
   */
  get isSQL(): boolean {
    return this._isSQL;
  }
  set isSQL(value: boolean) {
    this._isSQL = value;
    this._header?.update();
  }

  protected initializeDOM(): void {
    super.initializeDOM();
    this._header = (this.layout as PanelLayout).widgets.find(
      widget => widget instanceof CellHeader
    ) as CellHeader;

    this._header.createToolbar(this);
    this._checkSource();
  }

  /**
   * Check the source of the cell for the MAGIC command, and attach or detach
   * the toolbar if necessary.
   */
  private _checkSource(): boolean {
    if (!this._kernelInjection.getStatus(this)) {
      this.isSQL = false;
      return false;
    }
    const sourceStart = this.model.sharedModel.source.substring(
      0,
      MAGIC.length
    );
    if (sourceStart === MAGIC && !this.isSQL) {
      this.isSQL = true;
    } else if (sourceStart !== MAGIC && this.isSQL) {
      this.isSQL = false;
    }
    return this.isSQL;
  }

  /**
   * Triggered when the shared model change.
   */
  private _onSharedModelChanged = (_: ISharedCodeCell, change: CellChange) => {
    if (this._kernelInjection.getStatus(this) && change.sourceChange) {
      const firstLine = this.model.sharedModel.source.split('\n')[0];

      // If an object with the key 'retain' exists, it will give the position of the
      // change. Otherwise we assume the change occurs at position 0;
      const position =
        change.sourceChange.find(change => change.retain !== undefined)
          ?.retain || 0;

      // Check if the change occurs on the first line to update header and widgets.
      if (position <= firstLine.length) {
        if (this._checkSource()) {
          this._header?.update();
        }
      }
    }
  };

  private _header: CellHeader | undefined = undefined;
  private _kernelInjection: IKernelInjection;
  private _isSQL = false;
}

/**
 * The namespace for custom code cell.
 */
namespace CustomCodeCell {
  /**
   * The custom code cell options.
   */
  export interface IOptions extends CodeCell.IOptions {
    /**
     * The kernel injection, whether the kernel can handle sql magics or not.
     */
    kernelInjection: IKernelInjection;
  }
}

/**
 * The cell content factory.
 */
export class CellContentFactory
  extends Cell.ContentFactory
  implements Cell.IContentFactory
{
  /**
   * Create a content factory for a cell.
   */
  constructor(options: CellContentFactory.IOptions) {
    super(options);
    this._databasesPanel = options.databasesPanel;
  }

  /**
   * Create a new cell header for the parent widget.
   */
  createCellHeader(): ICellHeader {
    const databasesPanel = this._databasesPanel;
    return new CellHeader({ databasesPanel });
  }

  private _databasesPanel: IDatabasesPanel;
}

/**
 * The namespace for cell content factory.
 */
export namespace CellContentFactory {
  /**
   * The content factory options.
   */
  export interface IOptions extends Cell.ContentFactory.IOptions {
    /**
     * The databases panel, containing the known databases.
     */
    databasesPanel: IDatabasesPanel;
  }
}
